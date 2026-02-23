-- Create junction table for translation-product many-to-many relationship
CREATE TABLE IF NOT EXISTS public.translation_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_id UUID NOT NULL REFERENCES public.translations(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL REFERENCES public.products(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(translation_id, product_code)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_translation_products_translation_id
  ON public.translation_products(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_products_product_code
  ON public.translation_products(product_code);

-- Migrate existing data from translations.product_code to junction table
INSERT INTO public.translation_products (translation_id, product_code)
SELECT id, product_code
FROM public.translations
WHERE product_code IS NOT NULL
ON CONFLICT (translation_id, product_code) DO NOTHING;

-- Create junction table for glossary-product many-to-many relationship
CREATE TABLE IF NOT EXISTS public.glossary_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  glossary_id UUID NOT NULL REFERENCES public.glossary(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL REFERENCES public.products(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(glossary_id, product_code)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_glossary_products_glossary_id
  ON public.glossary_products(glossary_id);
CREATE INDEX IF NOT EXISTS idx_glossary_products_product_code
  ON public.glossary_products(product_code);

-- Migrate existing data from glossary.product_code to junction table
INSERT INTO public.glossary_products (glossary_id, product_code)
SELECT id, product_code
FROM public.glossary
WHERE product_code IS NOT NULL
ON CONFLICT (glossary_id, product_code) DO NOTHING;

-- Enable RLS
ALTER TABLE public.translation_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossary_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view translation products"
  ON public.translation_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage translation products"
  ON public.translation_products FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view glossary products"
  ON public.glossary_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage glossary products"
  ON public.glossary_products FOR ALL
  USING (auth.role() = 'authenticated');

-- Note: Keep old product_code columns for backward compatibility
-- They will be deprecated but not removed yet
