-- Migration: Create issues table
-- Created: 2026-03-06

-- Issues 테이블 생성
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_issues_product_code ON public.issues(product_code);
CREATE INDEX IF NOT EXISTS idx_issues_issue_type ON public.issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON public.issues(resolved);
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON public.issues(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues(created_at DESC);

-- RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if exist
DROP POLICY IF EXISTS "issues_select_policy" ON public.issues;
DROP POLICY IF EXISTS "issues_manage_policy" ON public.issues;

-- Create policies
CREATE POLICY "issues_select_policy" ON public.issues FOR SELECT
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (
        users.account_level = 'master' 
        OR users.account_level = '1st_master'
      )
    )
  );

CREATE POLICY "issues_manage_policy" ON public.issues FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.issues IS '번역 관련 이슈 관리 테이블';
