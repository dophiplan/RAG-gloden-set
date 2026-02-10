-- Create organization_settings table
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  openai_api_key TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users from rsupport.com to read and update
CREATE POLICY "Allow rsupport.com users to manage organization settings"
  ON public.organization_settings
  FOR ALL
  TO authenticated
  USING (
    -- Check if user email ends with @rsupport.com
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@rsupport.com'
    )
  )
  WITH CHECK (
    -- Check if user email ends with @rsupport.com
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@rsupport.com'
    )
  );

-- Add comment
COMMENT ON TABLE public.organization_settings IS
  'Organization-wide settings including shared API keys and configurations';

-- Insert default rsupport.com organization (optional)
INSERT INTO public.organization_settings (domain, settings)
VALUES ('rsupport.com', '{}'::jsonb)
ON CONFLICT (domain) DO NOTHING;
