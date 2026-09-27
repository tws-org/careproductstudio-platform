-- Add must_change_password flag to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Update RLS policies to include the new column
-- (Existing policies already cover SELECT/INSERT/UPDATE/DELETE on all columns)
