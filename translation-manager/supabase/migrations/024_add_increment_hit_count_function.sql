-- Create function to increment hit_count atomically
CREATE OR REPLACE FUNCTION increment_glossary_hit_count(
  p_term TEXT,
  p_language_code TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.glossary
  SET hit_count = hit_count + 1
  WHERE term = p_term AND language_code = p_language_code;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_glossary_hit_count(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION increment_glossary_hit_count IS 'Atomically increments the hit_count for a glossary term';
