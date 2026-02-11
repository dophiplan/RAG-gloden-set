-- Migration 038: Add default languages for products
-- Purpose: Set default language selections per product

-- Add default_languages column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS default_languages TEXT[] DEFAULT ARRAY['ko', 'en', 'ja'];

-- Set default languages for each product
-- RC: No default languages (user must select manually)
UPDATE products
SET default_languages = NULL
WHERE code = 'RC';

-- RV (알뷰): Korean, English, Japanese, Chinese
UPDATE products
SET default_languages = ARRAY['ko', 'en', 'ja', 'zh-CN']
WHERE code = 'RV';

-- All other products: Korean, English, Japanese
UPDATE products
SET default_languages = ARRAY['ko', 'en', 'ja']
WHERE code NOT IN ('RC', 'RV');

-- Add comment
COMMENT ON COLUMN products.default_languages IS 'Default language codes for this product (e.g., [ko, en, ja])';
