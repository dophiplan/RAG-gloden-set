-- =====================================================
-- Migration: 006_comprehensive_update.sql
-- Description: Comprehensive update for translation management system
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PHASE 1: ALTER EXISTING TABLES
-- =====================================================

-- 1.1 Extend translations table
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('SaaS', 'Solution')),
  ADD COLUMN IF NOT EXISTS work_scope TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dev_code TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS completion_rate INTEGER DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
  ADD COLUMN IF NOT EXISTS platform_completions JSONB DEFAULT '{}'::JSONB;

-- 1.2 Extend users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_products TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_scope TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_languages TEXT[] DEFAULT '{}';

-- =====================================================
-- PHASE 2: CREATE NEW TABLES
-- =====================================================

-- 2.1 Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_type TEXT NOT NULL UNIQUE CHECK (
    template_type IN (
      'translation_request',
      'review_request',
      'translation_complete',
      'deployment_complete'
    )
  ),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  default_deadline_days INT DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Email Logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_type TEXT NOT NULL,
  translation_ids UUID[] NOT NULL,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipients JSONB NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  custom_message TEXT,
  deadline DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 Holidays
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL CHECK (country_code IN ('KR', 'JP')),
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country_code, holiday_date)
);

-- 2.4 Issues
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT,
  issue_type TEXT NOT NULL CHECK (
    issue_type IN ('pdf_parse_error', 'image_parse_error', 'duplicate_text', 'validation_error')
  ),
  description TEXT NOT NULL,
  file_names TEXT[],
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.5 Organization Settings (for API key sharing)
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT NOT NULL UNIQUE,
  openai_api_key TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PHASE 3: CREATE INDEXES
-- =====================================================

-- Translations indexes
CREATE INDEX IF NOT EXISTS idx_translations_scope ON translations(scope);
CREATE INDEX IF NOT EXISTS idx_translations_work_scope ON translations USING GIN(work_scope);
CREATE INDEX IF NOT EXISTS idx_translations_completion_rate ON translations(completion_rate);
CREATE INDEX IF NOT EXISTS idx_translations_platform_completions ON translations USING GIN(platform_completions);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);
CREATE INDEX IF NOT EXISTS idx_users_work_products ON users USING GIN(work_products);
CREATE INDEX IF NOT EXISTS idx_users_work_scope ON users USING GIN(work_scope);
CREATE INDEX IF NOT EXISTS idx_users_work_languages ON users USING GIN(work_languages);

-- Email logs indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_translation_ids ON email_logs USING GIN(translation_ids);
CREATE INDEX IF NOT EXISTS idx_email_logs_sender_id ON email_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- Holidays indexes
CREATE INDEX IF NOT EXISTS idx_holidays_country_date ON holidays(country_code, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);

-- Issues indexes
CREATE INDEX IF NOT EXISTS idx_issues_product_code ON issues(product_code);
CREATE INDEX IF NOT EXISTS idx_issues_issue_type ON issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues(resolved);
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);

-- =====================================================
-- PHASE 4: CREATE TRIGGERS
-- =====================================================

-- 4.1 Trigger function for completion_rate calculation
CREATE OR REPLACE FUNCTION calculate_completion_rate()
RETURNS TRIGGER AS $$
DECLARE
  total_platforms INTEGER;
  completed_platforms INTEGER;
BEGIN
  -- Get total platforms from work_scope
  total_platforms := array_length(NEW.work_scope, 1);

  -- If no platforms defined, set rate to 0
  IF total_platforms IS NULL OR total_platforms = 0 THEN
    NEW.completion_rate := 0;
    RETURN NEW;
  END IF;

  -- Count completed platforms from platform_completions
  SELECT COUNT(*)
  INTO completed_platforms
  FROM jsonb_each(NEW.platform_completions) AS item
  WHERE (item.value->>'completed')::boolean = true;

  -- Calculate percentage
  NEW.completion_rate := ROUND((completed_platforms::NUMERIC / total_platforms::NUMERIC) * 100);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Create trigger
DROP TRIGGER IF EXISTS update_translation_completion_rate ON translations;
CREATE TRIGGER update_translation_completion_rate
  BEFORE INSERT OR UPDATE OF platform_completions, work_scope
  ON translations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_completion_rate();

-- 4.3 Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_settings_updated_at ON organization_settings;
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PHASE 5: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- 5.1 Email Templates RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view email templates" ON email_templates;
CREATE POLICY "Authenticated users can view email templates"
  ON public.email_templates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Only masters can manage email templates" ON email_templates;
CREATE POLICY "Only masters can manage email templates"
  ON public.email_templates FOR ALL
  USING (
    'master' = ANY(
      SELECT unnest(roles) FROM public.users WHERE id = auth.uid()
    )
  );

-- 5.2 Email Logs RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their sent emails" ON email_logs;
CREATE POLICY "Users can view their sent emails"
  ON public.email_logs FOR SELECT
  USING (
    sender_id = auth.uid() OR
    'master' = ANY(
      SELECT unnest(roles) FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can send emails" ON email_logs;
CREATE POLICY "Authenticated users can send emails"
  ON public.email_logs FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- 5.3 Holidays RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view holidays" ON holidays;
CREATE POLICY "Everyone can view holidays"
  ON public.holidays FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only masters can manage holidays" ON holidays;
CREATE POLICY "Only masters can manage holidays"
  ON public.holidays FOR ALL
  USING (
    'master' = ANY(
      SELECT unnest(roles) FROM public.users WHERE id = auth.uid()
    )
  );

-- 5.4 Issues RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own issues or all if master" ON issues;
CREATE POLICY "Users can view their own issues or all if master"
  ON public.issues FOR SELECT
  USING (
    user_id = auth.uid() OR
    'master' = ANY(
      SELECT unnest(roles) FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own issues" ON issues;
CREATE POLICY "Users can manage their own issues"
  ON public.issues FOR ALL
  USING (user_id = auth.uid());

-- 5.5 Organization Settings RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only masters can view organization settings" ON organization_settings;
CREATE POLICY "Only masters can view organization settings"
  ON public.organization_settings FOR SELECT
  USING (
    'master' = ANY(
      SELECT unnest(roles) FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Only masters can manage organization settings" ON organization_settings;
CREATE POLICY "Only masters can manage organization settings"
  ON public.organization_settings FOR ALL
  USING (
    'master' = ANY(
      SELECT unnest(roles) FROM public.users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- PHASE 6: SEED DATA
-- =====================================================

-- 6.1 Initialize organization settings for rsupport.com
INSERT INTO public.organization_settings (domain, settings)
VALUES ('rsupport.com', '{}')
ON CONFLICT (domain) DO NOTHING;

-- 6.2 Email Templates
INSERT INTO public.email_templates (template_type, subject, body_html, body_text, default_deadline_days) VALUES
(
  'translation_request',
  '[번역 요청] {{product_name}} {{version}} - {{language_list}}',
  '<html><body>
    <h2>번역 요청</h2>
    <p>다음 항목에 대한 번역이 요청되었습니다.</p>
    <ul>
      <li><strong>제품:</strong> {{product_name}}</li>
      <li><strong>버전:</strong> {{version}}</li>
      <li><strong>언어:</strong> {{language_list}}</li>
      <li><strong>항목 수:</strong> {{count}}</li>
      <li><strong>마감일:</strong> {{deadline}}</li>
    </ul>
    <p>{{custom_message}}</p>
    <p><a href="{{url}}">번역 관리 시스템으로 이동</a></p>
  </body></html>',
  '번역 요청\n\n제품: {{product_name}}\n버전: {{version}}\n언어: {{language_list}}\n항목 수: {{count}}\n마감일: {{deadline}}\n\n{{custom_message}}\n\n링크: {{url}}',
  3
),
(
  'review_request',
  '[검수 요청] {{product_name}} {{version}} - {{language}}',
  '<html><body>
    <h2>검수 요청</h2>
    <p>다음 항목에 대한 검수가 요청되었습니다.</p>
    <ul>
      <li><strong>제품:</strong> {{product_name}}</li>
      <li><strong>버전:</strong> {{version}}</li>
      <li><strong>언어:</strong> {{language}}</li>
      <li><strong>항목 수:</strong> {{count}}</li>
      <li><strong>마감일:</strong> {{deadline}}</li>
    </ul>
    <p>{{custom_message}}</p>
    <p><a href="{{url}}">번역 관리 시스템으로 이동</a></p>
  </body></html>',
  '검수 요청\n\n제품: {{product_name}}\n버전: {{version}}\n언어: {{language}}\n항목 수: {{count}}\n마감일: {{deadline}}\n\n{{custom_message}}\n\n링크: {{url}}',
  2
),
(
  'translation_complete',
  '[번역 완료] {{product_name}} {{version}}',
  '<html><body>
    <h2>번역 완료</h2>
    <p>다음 항목에 대한 번역이 완료되었습니다.</p>
    <ul>
      <li><strong>제품:</strong> {{product_name}}</li>
      <li><strong>버전:</strong> {{version}}</li>
      <li><strong>완료 언어:</strong> {{language_list}}</li>
      <li><strong>항목 수:</strong> {{count}}</li>
      <li><strong>완료 시간:</strong> {{completed_at}}</li>
    </ul>
    <p>{{custom_message}}</p>
    <p><a href="{{url}}">번역 관리 시스템으로 이동</a></p>
  </body></html>',
  '번역 완료\n\n제품: {{product_name}}\n버전: {{version}}\n완료 언어: {{language_list}}\n항목 수: {{count}}\n완료 시간: {{completed_at}}\n\n{{custom_message}}\n\n링크: {{url}}',
  0
),
(
  'deployment_complete',
  '[반영 완료] {{product_name}} {{version}}',
  '<html><body>
    <h2>반영 완료</h2>
    <p>다음 항목에 대한 반영이 완료되었습니다.</p>
    <ul>
      <li><strong>제품:</strong> {{product_name}}</li>
      <li><strong>버전:</strong> {{version}}</li>
      <li><strong>완료 플랫폼:</strong> {{platform_list}}</li>
      <li><strong>항목 수:</strong> {{count}}</li>
      <li><strong>완료율:</strong> {{completion_rate}}%</li>
      <li><strong>완료 시간:</strong> {{completed_at}}</li>
    </ul>
    <p>{{custom_message}}</p>
    <p><a href="{{url}}">번역 관리 시스템으로 이동</a></p>
  </body></html>',
  '반영 완료\n\n제품: {{product_name}}\n버전: {{version}}\n완료 플랫폼: {{platform_list}}\n항목 수: {{count}}\n완료율: {{completion_rate}}%\n완료 시간: {{completed_at}}\n\n{{custom_message}}\n\n링크: {{url}}',
  0
)
ON CONFLICT (template_type) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  default_deadline_days = EXCLUDED.default_deadline_days,
  updated_at = NOW();

-- 6.3 Korean Holidays (2024-2026)
INSERT INTO public.holidays (country_code, holiday_date, name, recurring) VALUES
  -- 2024
  ('KR', '2024-01-01', '신정', true),
  ('KR', '2024-02-09', '설날 연휴', false),
  ('KR', '2024-02-10', '설날', false),
  ('KR', '2024-02-11', '설날 연휴', false),
  ('KR', '2024-02-12', '대체공휴일', false),
  ('KR', '2024-03-01', '삼일절', true),
  ('KR', '2024-04-10', '국회의원 선거일', false),
  ('KR', '2024-05-05', '어린이날', true),
  ('KR', '2024-05-06', '대체공휴일', false),
  ('KR', '2024-05-15', '부처님 오신 날', false),
  ('KR', '2024-06-06', '현충일', true),
  ('KR', '2024-08-15', '광복절', true),
  ('KR', '2024-09-16', '추석 연휴', false),
  ('KR', '2024-09-17', '추석', false),
  ('KR', '2024-09-18', '추석 연휴', false),
  ('KR', '2024-10-03', '개천절', true),
  ('KR', '2024-10-09', '한글날', true),
  ('KR', '2024-12-25', '크리스마스', true),

  -- 2025
  ('KR', '2025-01-01', '신정', true),
  ('KR', '2025-01-28', '설날 연휴', false),
  ('KR', '2025-01-29', '설날', false),
  ('KR', '2025-01-30', '설날 연휴', false),
  ('KR', '2025-03-01', '삼일절', true),
  ('KR', '2025-03-03', '대체공휴일', false),
  ('KR', '2025-05-05', '어린이날', true),
  ('KR', '2025-05-06', '부처님 오신 날', false),
  ('KR', '2025-06-06', '현충일', true),
  ('KR', '2025-08-15', '광복절', true),
  ('KR', '2025-10-05', '추석 연휴', false),
  ('KR', '2025-10-06', '추석', false),
  ('KR', '2025-10-07', '추석 연휴', false),
  ('KR', '2025-10-08', '대체공휴일', false),
  ('KR', '2025-10-03', '개천절', true),
  ('KR', '2025-10-09', '한글날', true),
  ('KR', '2025-12-25', '크리스마스', true),

  -- 2026
  ('KR', '2026-01-01', '신정', true),
  ('KR', '2026-02-16', '설날 연휴', false),
  ('KR', '2026-02-17', '설날', false),
  ('KR', '2026-02-18', '설날 연휴', false),
  ('KR', '2026-03-01', '삼일절', true),
  ('KR', '2026-05-05', '어린이날', true),
  ('KR', '2026-05-25', '부처님 오신 날', false),
  ('KR', '2026-06-06', '현충일', true),
  ('KR', '2026-08-15', '광복절', true),
  ('KR', '2026-09-24', '추석 연휴', false),
  ('KR', '2026-09-25', '추석', false),
  ('KR', '2026-09-26', '추석 연휴', false),
  ('KR', '2026-10-03', '개천절', true),
  ('KR', '2026-10-09', '한글날', true),
  ('KR', '2026-12-25', '크리스마스', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- 6.4 Japanese Holidays (2024-2026)
INSERT INTO public.holidays (country_code, holiday_date, name, recurring) VALUES
  -- 2024
  ('JP', '2024-01-01', '元日', true),
  ('JP', '2024-01-08', '成人の日', false),
  ('JP', '2024-02-11', '建国記念の日', true),
  ('JP', '2024-02-12', '振替休日', false),
  ('JP', '2024-02-23', '天皇誕生日', true),
  ('JP', '2024-03-20', '春分の日', false),
  ('JP', '2024-04-29', '昭和の日', true),
  ('JP', '2024-05-03', '憲法記念日', true),
  ('JP', '2024-05-04', 'みどりの日', true),
  ('JP', '2024-05-05', 'こどもの日', true),
  ('JP', '2024-05-06', '振替休日', false),
  ('JP', '2024-07-15', '海の日', false),
  ('JP', '2024-08-11', '山の日', true),
  ('JP', '2024-08-12', '振替休日', false),
  ('JP', '2024-09-16', '敬老の日', false),
  ('JP', '2024-09-22', '秋分の日', false),
  ('JP', '2024-09-23', '振替休日', false),
  ('JP', '2024-10-14', 'スポーツの日', false),
  ('JP', '2024-11-03', '文化の日', true),
  ('JP', '2024-11-04', '振替休日', false),
  ('JP', '2024-11-23', '勤労感謝の日', true),

  -- 2025
  ('JP', '2025-01-01', '元日', true),
  ('JP', '2025-01-13', '成人の日', false),
  ('JP', '2025-02-11', '建国記念の日', true),
  ('JP', '2025-02-23', '天皇誕生日', true),
  ('JP', '2025-02-24', '振替休日', false),
  ('JP', '2025-03-20', '春分の日', false),
  ('JP', '2025-04-29', '昭和の日', true),
  ('JP', '2025-05-03', '憲法記念日', true),
  ('JP', '2025-05-04', 'みどりの日', true),
  ('JP', '2025-05-05', 'こどもの日', true),
  ('JP', '2025-05-06', '振替休日', false),
  ('JP', '2025-07-21', '海の日', false),
  ('JP', '2025-08-11', '山の日', true),
  ('JP', '2025-09-15', '敬老の日', false),
  ('JP', '2025-09-23', '秋分の日', false),
  ('JP', '2025-10-13', 'スポーツの日', false),
  ('JP', '2025-11-03', '文化の日', true),
  ('JP', '2025-11-23', '勤労感謝の日', true),
  ('JP', '2025-11-24', '振替休日', false),

  -- 2026
  ('JP', '2026-01-01', '元日', true),
  ('JP', '2026-01-12', '成人の日', false),
  ('JP', '2026-02-11', '建国記念の日', true),
  ('JP', '2026-02-23', '天皇誕生日', true),
  ('JP', '2026-03-20', '春分の日', false),
  ('JP', '2026-04-29', '昭和の日', true),
  ('JP', '2026-05-03', '憲法記念日', true),
  ('JP', '2026-05-04', 'みどりの日', true),
  ('JP', '2026-05-05', 'こどもの日', true),
  ('JP', '2026-05-06', '振替休日', false),
  ('JP', '2026-07-20', '海の日', false),
  ('JP', '2026-08-11', '山の日', true),
  ('JP', '2026-09-21', '敬老の日', false),
  ('JP', '2026-09-22', '秋分の日', false),
  ('JP', '2026-10-12', 'スポーツの日', false),
  ('JP', '2026-11-03', '文化の日', true),
  ('JP', '2026-11-23', '勤労感謝の日', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
