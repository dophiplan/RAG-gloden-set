-- Migration: Add priority_order column for proper sorting
-- Priority sorting: 긴급(4) > 상(3) > 중(2) > 하(1)

-- Add priority_order column
ALTER TABLE translations
ADD COLUMN priority_order INTEGER DEFAULT 2;

-- Update existing rows based on priority
UPDATE translations
SET priority_order = CASE priority
  WHEN '긴급' THEN 4
  WHEN '상' THEN 3
  WHEN '중' THEN 2
  WHEN '하' THEN 1
  ELSE 2
END;

-- Create function to automatically set priority_order
CREATE OR REPLACE FUNCTION set_priority_order()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_order := CASE NEW.priority
    WHEN '긴급' THEN 4
    WHEN '상' THEN 3
    WHEN '중' THEN 2
    WHEN '하' THEN 1
    ELSE 2
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update priority_order on insert/update
DROP TRIGGER IF EXISTS translations_priority_order_trigger ON translations;
CREATE TRIGGER translations_priority_order_trigger
BEFORE INSERT OR UPDATE OF priority ON translations
FOR EACH ROW
EXECUTE FUNCTION set_priority_order();

-- Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_translations_priority_sort
ON translations (priority_order DESC, completion_date ASC NULLS LAST, created_at DESC);

-- Comment
COMMENT ON COLUMN translations.priority_order IS 'Numeric value for priority sorting: 긴급(4), 상(3), 중(2), 하(1)';
