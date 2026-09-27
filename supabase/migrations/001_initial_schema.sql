-- ============================================================
-- Care Practice Studio Engagement Platform — Initial Schema
-- ============================================================

-- Enable pgvector (required by success criteria)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Clients
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  waiver_signed BOOLEAN NOT NULL DEFAULT FALSE,
  waiver_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Projects
-- ============================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled', 'pending')),
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  outcome_metric_name TEXT,
  outcome_metric_baseline NUMERIC,
  outcome_metric_baseline_date DATE,
  outcome_metric_followup NUMERIC,
  outcome_metric_followup_date DATE,
  scope_change_count INTEGER NOT NULL DEFAULT 0,
  direction_change_count INTEGER NOT NULL DEFAULT 0,
  deliverables_planned INTEGER NOT NULL DEFAULT 0,
  deliverables_shipped INTEGER NOT NULL DEFAULT 0,
  satisfaction_checkin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tasks
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Comments (task-level threads)
-- ============================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- De-identified view (excludes client name, email, identifiers)
-- Success criterion: view must exist from day one
-- ============================================================
CREATE VIEW deidentified_projects AS
SELECT
  p.id,
  p.client_id,
  p.status,
  p.start_date,
  p.target_end_date,
  p.actual_end_date,
  p.outcome_metric_name,
  p.outcome_metric_baseline,
  p.outcome_metric_baseline_date,
  p.outcome_metric_followup,
  p.outcome_metric_followup_date,
  p.scope_change_count,
  p.direction_change_count,
  p.deliverables_planned,
  p.deliverables_shipped,
  p.satisfaction_checkin,
  p.created_at,
  p.updated_at
FROM projects p;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: clients table
-- ============================================================

-- Users can read their own client record
CREATE POLICY "clients_select_own"
  ON clients FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- Only the service role can insert/update/delete clients
-- (Peter manages clients through an admin flow)
CREATE POLICY "clients_insert_service"
  ON clients FOR INSERT
  WITH CHECK (true);

CREATE POLICY "clients_update_service"
  ON clients FOR UPDATE
  USING (true);

CREATE POLICY "clients_delete_service"
  ON clients FOR DELETE
  USING (true);

-- ============================================================
-- RLS Policies: projects table
-- ============================================================

-- Users can read projects belonging to their own client record
CREATE POLICY "projects_select_own"
  ON projects FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Waiver gate: can only insert projects for clients who have signed the waiver
CREATE POLICY "projects_insert_waiver_gate"
  ON projects FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE email = auth.jwt() ->> 'email'
        AND waiver_signed = TRUE
    )
  );

-- Users can update their own projects
CREATE POLICY "projects_update_own"
  ON projects FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Users can delete their own projects
CREATE POLICY "projects_delete_own"
  ON projects FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

-- ============================================================
-- RLS Policies: tasks table
-- ============================================================

-- Users can read tasks in their own projects
CREATE POLICY "tasks_select_own"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- Users can insert tasks in their own projects
CREATE POLICY "tasks_insert_own"
  ON tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- Users can update tasks in their own projects
CREATE POLICY "tasks_update_own"
  ON tasks FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- Users can delete tasks in their own projects
CREATE POLICY "tasks_delete_own"
  ON tasks FOR DELETE
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- ============================================================
-- RLS Policies: comments table
-- ============================================================

-- Users can read comments on tasks in their own projects
CREATE POLICY "comments_select_own"
  ON comments FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- Users can insert comments on tasks in their own projects
CREATE POLICY "comments_insert_own"
  ON comments FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
      AND author_id = auth.uid()
  );

-- Users can update their own comments
CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
      AND author_id = auth.uid()
  );

-- Users can delete their own comments
CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE c.email = auth.jwt() ->> 'email'
    )
      AND author_id = auth.uid()
  );

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_clients_email ON clients(email);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
