-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default products
INSERT INTO public.products (code, name, display_order) VALUES
  ('RC', 'RC', 1),
  ('RV', 'RV', 2),
  ('RM', 'RM', 3),
  ('Rfice', 'Rfice', 4),
  ('repoto', 'repoto', 5),
  ('RVS', 'RVS', 6),
  ('mobizen', '모비즌', 7),
  ('agent', '에이전트', 8),
  ('marketing', '마케팅', 9)
ON CONFLICT (code) DO NOTHING;

-- Add version and product_code to translations table
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS product_code TEXT REFERENCES public.products(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_updated_at TIMESTAMP WITH TIME ZONE;

-- Add product_code to glossary table
ALTER TABLE public.glossary
  ADD COLUMN IF NOT EXISTS product_code TEXT REFERENCES public.products(code) ON DELETE SET NULL;

-- Translation audit logs table
CREATE TABLE IF NOT EXISTS public.translation_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_id UUID REFERENCES public.translations(id) ON DELETE CASCADE,
  translation_result_id UUID REFERENCES public.translation_results(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'ai_translate')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings table for API keys
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  openai_api_key TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_translations_version ON public.translations(version);
CREATE INDEX IF NOT EXISTS idx_translations_product_code ON public.translations(product_code);
CREATE INDEX IF NOT EXISTS idx_translations_version_updated_at ON public.translations(version_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_product_code ON public.glossary(product_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_translation_id ON public.translation_audit_logs(translation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_translation_result_id ON public.translation_audit_logs(translation_result_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.translation_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.translation_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products (read-only for authenticated users)
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for translation_audit_logs
CREATE POLICY "Users can view audit logs for their translations"
  ON public.translation_audit_logs FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.translations t
        WHERE t.id = translation_audit_logs.translation_id
        AND t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.translation_audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for user_settings
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger for user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
