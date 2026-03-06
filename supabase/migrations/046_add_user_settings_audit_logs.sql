-- Migration: Add User and Settings Audit Logs

-- User management audit logs
CREATE TABLE IF NOT EXISTS public.user_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL, -- create, update, delete, bulk_update, bulk_delete, permission_change
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
  action TEXT NOT NULL, -- update_openai_key, update_org_settings, etc.
  setting_category TEXT NOT NULL, -- 'openai', 'organization', 'system'
  setting_key TEXT,
  old_value TEXT,
  new_value TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE, -- For masking sensitive values
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_audit_logs_user ON public.user_audit_logs(user_id);
CREATE INDEX idx_user_audit_logs_target ON public.user_audit_logs(target_user_id);
CREATE INDEX idx_user_audit_logs_created ON public.user_audit_logs(created_at DESC);
CREATE INDEX idx_settings_audit_logs_user ON public.settings_audit_logs(user_id);
CREATE INDEX idx_settings_audit_logs_category ON public.settings_audit_logs(setting_category);
CREATE INDEX idx_settings_audit_logs_created ON public.settings_audit_logs(created_at DESC);

-- RLS
ALTER TABLE public.user_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View user audit logs" ON public.user_audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert user audit logs" ON public.user_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "View settings audit logs" ON public.settings_audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert settings audit logs" ON public.settings_audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
