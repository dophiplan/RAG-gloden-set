-- Migration: Fix Audit Logs Tables
-- Created: 2026-03-06
-- Description: Create user_audit_logs and settings_audit_logs tables with shorter index names

-- User management audit logs
CREATE TABLE IF NOT EXISTS public.user_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_email TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings audit logs  
CREATE TABLE IF NOT EXISTS public.settings_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  setting_category TEXT NOT NULL,
  setting_key TEXT,
  old_value TEXT,
  new_value TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_audit_logs
CREATE INDEX IF NOT EXISTS idx_ual_user ON public.user_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ual_target ON public.user_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_ual_created ON public.user_audit_logs(created_at DESC);

-- Indexes for settings_audit_logs
CREATE INDEX IF NOT EXISTS idx_sal_user ON public.settings_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sal_category ON public.settings_audit_logs(setting_category);
CREATE INDEX IF NOT EXISTS idx_sal_created ON public.settings_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_audit_logs' AND policyname = 'user_audit_logs_view'
  ) THEN
    CREATE POLICY "user_audit_logs_view" ON public.user_audit_logs FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_audit_logs' AND policyname = 'user_audit_logs_insert'
  ) THEN
    CREATE POLICY "user_audit_logs_insert" ON public.user_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;

-- RLS Policies for settings_audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings_audit_logs' AND policyname = 'settings_audit_logs_view'
  ) THEN
    CREATE POLICY "settings_audit_logs_view" ON public.settings_audit_logs FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings_audit_logs' AND policyname = 'settings_audit_logs_insert'
  ) THEN
    CREATE POLICY "settings_audit_logs_insert" ON public.settings_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;
