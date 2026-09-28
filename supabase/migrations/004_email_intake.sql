-- ============================================================
-- Care Practice Studio Engagement Platform — Slice A: Email Intake
-- Tables: client_email_addresses, messages, review_queue, documents
-- ============================================================

-- ============================================================
-- Registered client email addresses (sender verification)
-- A client may have several addresses; inbound mail is only filed
-- when the sender matches one of these.
-- ============================================================
CREATE TABLE client_email_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Messages (email log) — inbound and outbound, per client.
-- Threading headers are stored as normalized values (no angle brackets).
-- thread_id is the Message-ID of the thread's root message.
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender TEXT NOT NULL,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  references TEXT[] NOT NULL DEFAULT '{}',
  thread_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks may reference the source message (used in Slice B)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- ============================================================
-- Review queue — inbound mail that could not be safely filed.
-- Never auto-filed to a client record; Peter approves or discards.
-- ============================================================
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  headers JSONB,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filed', 'discarded')),
  filed_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  filed_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Documents — files attached to a client/project, incl. email attachments.
-- Files are only downloadable when scan_status = 'clean'.
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'quarantined', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Storage bucket for documents (private; downloads via signed URLs)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE client_email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- client_email_addresses: clients can see their own addresses.
-- All writes go through the service role (Peter / platform).
-- ------------------------------------------------------------
CREATE POLICY "client_email_addresses_select_own"
  ON client_email_addresses FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

-- ------------------------------------------------------------
-- messages: clients can read their own messages only.
-- Inserts/updates/deletes are service-role only (no policies for
-- anon/authenticated, so the database itself denies them).
-- ------------------------------------------------------------
CREATE POLICY "messages_select_own"
  ON messages FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

-- ------------------------------------------------------------
-- review_queue: no client-role policies at all — clients can
-- never read review-queue items, even via a direct query.
-- (Slice C success criterion 24, enforced here from day one.)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- documents: clients can see their own documents only.
-- ------------------------------------------------------------
CREATE POLICY "documents_select_own"
  ON documents FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_client_email_addresses_client_id ON client_email_addresses(client_id);
CREATE INDEX idx_client_email_addresses_email ON client_email_addresses(email);
CREATE INDEX idx_messages_client_id ON messages(client_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_message_id ON documents(message_id);

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE TRIGGER client_email_addresses_updated_at
  BEFORE UPDATE ON client_email_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER review_queue_updated_at
  BEFORE UPDATE ON review_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
