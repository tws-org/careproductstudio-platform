export interface Client {
  id: string;
  name: string;
  email: string;
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientEmailAddress {
  id: string;
  client_id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: "active" | "on_hold" | "completed" | "cancelled";
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  outcome_metric_name: string | null;
  outcome_metric_baseline: number | null;
  outcome_metric_baseline_date: string | null;
  outcome_metric_followup: number | null;
  outcome_metric_followup_date: string | null;
  scope_change_count: number;
  direction_change_count: number;
  deliverables_planned: number;
  deliverables_shipped: number;
  satisfaction_checkin: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  client_id: string;
  project_id: string | null;
  direction: MessageDirection;
  sender: string;
  recipients: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  reference_ids: string[];
  thread_id: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export type ReviewQueueStatus = "pending" | "filed" | "discarded";

export interface ReviewQueueItem {
  id: string;
  reason: string;
  sender: string;
  recipients: string[];
  subject: string | null;
  headers: Record<string, unknown> | null;
  body_text: string | null;
  body_html: string | null;
  attachments: ReviewQueueAttachment[];
  status: ReviewQueueStatus;
  filed_client_id: string | null;
  filed_message_id: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueAttachment {
  filename: string;
  content_type: string;
  size: number;
  data_base64?: string;
}

export type DocumentScanStatus = "pending" | "clean" | "quarantined" | "rejected";

export interface Document {
  id: string;
  client_id: string;
  project_id: string | null;
  message_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string | null;
  scan_status: DocumentScanStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done";
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Shape of the POST body sent by the Cloudflare Email Worker to /api/email/inbound */
export interface InboundEmailPayload {
  from: string;
  envelope_from: string;
  to: string;
  subject: string | null;
  date: string | null;
  headers: {
    "message-id"?: string;
    "in-reply-to"?: string;
    references?: string;
    "authentication-results"?: string;
    "arc-authentication-results"?: string;
    "dkim-signature"?: string;
  };
  text: string | null;
  html: string | null;
  attachments: InboundAttachmentPayload[];
}

export interface InboundAttachmentPayload {
  filename: string;
  content_type: string;
  size: number;
  data_base64: string;
}
