-- Step 1: Create table
CREATE TABLE IF NOT EXISTS public.glossary_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  glossary_term_id UUID REFERENCES public.glossary(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create index
CREATE INDEX IF NOT EXISTS idx_audit_term_id ON public.glossary_audit_logs(glossary_term_id);

-- Step 3: Enable RLS
ALTER TABLE public.glossary_audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if any
DO $$
BEGIN
  DROP POLICY IF EXISTS "audit_select_policy" ON public.glossary_audit_logs;
  DROP POLICY IF EXISTS "audit_insert_policy" ON public.glossary_audit_logs;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Step 5: Create policies
CREATE POLICY audit_select_policy
  ON public.glossary_audit_logs FOR SELECT
  USING (true);

CREATE POLICY audit_insert_policy
  ON public.glossary_audit_logs FOR INSERT
  WITH CHECK (true);
