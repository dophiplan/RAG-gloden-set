-- Add approval workflow fields to glossary table
-- This enables approval workflow for AI-generated glossary terms

ALTER TABLE glossary
ADD COLUMN approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

-- Add index for filtering by approval status
CREATE INDEX idx_glossary_approval_status ON glossary(approval_status);

-- Update existing data based on source_type
-- Manual and imported terms should be auto-approved
UPDATE glossary SET approval_status = 'approved' WHERE source_type IN ('manual', 'excel_import');

-- AI-generated terms should be marked as pending for review
UPDATE glossary SET approval_status = 'pending' WHERE source_type = 'ai_generated';

COMMENT ON COLUMN glossary.approval_status IS 'Approval status: pending (awaiting review), approved (ready for use), rejected (not suitable)';
COMMENT ON COLUMN glossary.approved_by IS 'User who approved/rejected this term';
COMMENT ON COLUMN glossary.approved_at IS 'Timestamp when the term was approved/rejected';
