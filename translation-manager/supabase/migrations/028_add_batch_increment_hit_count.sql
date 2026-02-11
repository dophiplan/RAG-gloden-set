-- Create function to batch increment hit_count for multiple terms
CREATE OR REPLACE FUNCTION batch_increment_glossary_hit_count(
  p_updates JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_update JSONB;
BEGIN
  -- p_updates format: [{"term": "...", "language_code": "..."}]
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE public.glossary
    SET hit_count = hit_count + 1
    WHERE term = (v_update->>'term')
      AND language_code = (v_update->>'language_code');
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION batch_increment_glossary_hit_count(JSONB) TO authenticated;

COMMENT ON FUNCTION batch_increment_glossary_hit_count IS 'Atomically increments hit_count for multiple glossary terms in a single transaction';
