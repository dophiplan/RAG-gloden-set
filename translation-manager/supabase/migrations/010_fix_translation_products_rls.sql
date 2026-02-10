-- Fix RLS policy for translation_products to allow INSERT operations
-- The previous policy used FOR ALL USING which doesn't properly handle INSERT

-- Drop the old policy
DROP POLICY IF EXISTS "Authenticated users can manage translation products" ON public.translation_products;

-- Create separate policies for each operation
CREATE POLICY "Authenticated users can view translation products"
  ON public.translation_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert translation products"
  ON public.translation_products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update translation products"
  ON public.translation_products FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete translation products"
  ON public.translation_products FOR DELETE
  USING (auth.role() = 'authenticated');
