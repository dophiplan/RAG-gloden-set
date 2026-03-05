-- Migration: Add Rollback System

-- Rollback operations tracking
CREATE TABLE IF NOT EXISTS public.rollback_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  target_type TEXT NOT NULL,
  rollback_type TEXT NOT NULL,
  original_action_id UUID,
  batch_operation_id UUID,
  rolled_back_data JSONB,
  conflict_resolution TEXT,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Operation batches for grouping related operations
CREATE TABLE IF NOT EXISTS public.operation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  description TEXT,
  affected_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  rolled_back_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Add rollback columns to translation_audit_logs
ALTER TABLE public.translation_audit_logs 
ADD COLUMN IF NOT EXISTS batch_operation_id UUID REFERENCES public.operation_batches(id);

ALTER TABLE public.translation_audit_logs 
ADD COLUMN IF NOT EXISTS is_rolled_back BOOLEAN DEFAULT FALSE;

ALTER TABLE public.translation_audit_logs 
ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP WITH TIME ZONE;

-- Add rollback columns to glossary_audit_logs
ALTER TABLE public.glossary_audit_logs 
ADD COLUMN IF NOT EXISTS batch_operation_id UUID REFERENCES public.operation_batches(id);

ALTER TABLE public.glossary_audit_logs 
ADD COLUMN IF NOT EXISTS is_rolled_back BOOLEAN DEFAULT FALSE;

ALTER TABLE public.glossary_audit_logs 
ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP WITH TIME ZONE;

-- Indexes
CREATE INDEX idx_rollback_ops_user ON public.rollback_operations(user_id);
CREATE INDEX idx_rollback_ops_created ON public.rollback_operations(created_at DESC);
CREATE INDEX idx_operation_batches_user ON public.operation_batches(user_id);
CREATE INDEX idx_trans_audit_rolledback ON public.translation_audit_logs(is_rolled_back) WHERE is_rolled_back = TRUE;
CREATE INDEX idx_glossary_audit_rolledback ON public.glossary_audit_logs(is_rolled_back) WHERE is_rolled_back = TRUE;

-- RLS
ALTER TABLE public.rollback_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rollback ops" ON public.rollback_operations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert rollback ops" ON public.rollback_operations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "View batches" ON public.operation_batches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert batches" ON public.operation_batches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
