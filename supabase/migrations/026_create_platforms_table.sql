-- Create platforms table
CREATE TABLE IF NOT EXISTS platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_platforms_code ON platforms(code);
CREATE INDEX IF NOT EXISTS idx_platforms_display_order ON platforms(display_order);

-- Insert default platforms in alphabetical order
INSERT INTO platforms (code, name, description, display_order) VALUES
  ('Android', 'Android', 'Android 플랫폼', 1),
  ('Back', 'Backend', '백엔드', 2),
  ('core', 'Core', '핵심 시스템', 3),
  ('Email', 'Email', '이메일', 4),
  ('Error', 'Error', '에러 메시지', 5),
  ('etc', 'Etc', '기타', 6),
  ('Flutter', 'Flutter', 'Flutter 플랫폼', 7),
  ('Front', 'Frontend', '프론트엔드', 8),
  ('iOS', 'iOS', 'iOS 플랫폼', 9),
  ('Mac', 'Mac', 'Mac 플랫폼', 10),
  ('Win', 'Windows', 'Windows 플랫폼', 11),
  ('스토어(android)', '스토어(Android)', 'Android 스토어', 12),
  ('스토어(iOS)', '스토어(iOS)', 'iOS 스토어', 13)
ON CONFLICT (code) DO NOTHING;

-- Enable RLS
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read
CREATE POLICY "Allow authenticated users to read platforms"
  ON platforms FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated users to manage platforms"
  ON platforms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
