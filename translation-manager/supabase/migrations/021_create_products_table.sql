-- Migration: Create products table for dynamic product management
-- Allows admins to add/edit products from settings page

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing products
INSERT INTO products (code, name, display_order) VALUES
  ('RC', 'RC', 1),
  ('RV', 'RV', 2),
  ('RM', 'RM', 3),
  ('Rfice', 'rfice', 4),
  ('repoto', 'repoto', 5),
  ('RVS', 'RVS', 6),
  ('mobizen', '모비즌', 7),
  ('agent', '에이전트', 8),
  ('marketing', '마케팅', 9)
ON CONFLICT (code) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at_trigger
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_products_updated_at();

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read products
CREATE POLICY "Anyone can read products"
ON products FOR SELECT
TO authenticated
USING (true);

-- Policy: Only master users can insert/update/delete products
CREATE POLICY "Only master users can modify products"
ON products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.roles @> ARRAY['master'] OR users.roles @> ARRAY['1st_master'])
  )
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_products_display_order ON products (display_order ASC);

-- Comments
COMMENT ON TABLE products IS 'Dynamic product list managed by admins';
COMMENT ON COLUMN products.code IS 'Unique product code (e.g., RC, RV, RM)';
COMMENT ON COLUMN products.name IS 'Display name for the product';
COMMENT ON COLUMN products.display_order IS 'Order for displaying products in UI';
