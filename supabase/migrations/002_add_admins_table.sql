-- Admins table: only admins can manage other admins
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only admins can read the admins list
CREATE POLICY "admins_select_admins"
  ON admins FOR SELECT
  USING (email IN (SELECT email FROM admins));

-- Only admins can insert new admins
CREATE POLICY "admins_insert_admins"
  ON admins FOR INSERT
  WITH CHECK (email IN (SELECT email FROM admins));

-- Only admins can delete admins
CREATE POLICY "admins_delete_admins"
  ON admins FOR DELETE
  USING (email IN (SELECT email FROM admins));
