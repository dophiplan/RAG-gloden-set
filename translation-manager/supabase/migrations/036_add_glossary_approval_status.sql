-- Migration: Add glossary approval workflow
-- Purpose: Track approval status for AI-generated glossary terms
-- Date: 2026-02-11

-- Add approval status fields to glossary table
ALTER TABLE glossary
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Add index for filtering by approval status
CREATE INDEX IF NOT EXISTS idx_glossary_approval_status
ON glossary(approval_status);

-- Add index for approved_by queries
CREATE INDEX IF NOT EXISTS idx_glossary_approved_by
ON glossary(approved_by);

-- Add comments for documentation
COMMENT ON COLUMN glossary.approval_status IS 'Approval status: pending (needs review), approved (ready for use), rejected (not approved)';
COMMENT ON COLUMN glossary.approved_by IS 'User ID who approved/rejected the term';
COMMENT ON COLUMN glossary.approved_at IS 'Timestamp when the term was approved/rejected';

-- Set existing manual/imported terms as approved
UPDATE glossary
SET approval_status = 'approved'
WHERE source_type IN ('manual', 'excel_import')
  AND approval_status IS NULL;

-- Set existing AI-generated terms as pending for review
UPDATE glossary
SET approval_status = 'pending'
WHERE source_type = 'ai_generated'
  AND approval_status IS NULL;

-- Note: New terms will default to 'approved' unless explicitly set to 'pending'
-- AI-generated terms should be created with approval_status='pending'
