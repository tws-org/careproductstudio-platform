import { createAdminSupabaseClient } from "./supabase-admin";
import { scanBuffer } from "./malware-scan";
import { putFile } from "./storage";
import type {
  Document,
  InboundAttachmentPayload,
  Message,
  ReviewQueueAttachment,
} from "./types";

/**
 * Filing logic for inbound mail, shared by the email webhook
 * (/api/email/inbound) and the review-queue "file to client" action.
 */

export const MAX_ATTACHMENT_BYTES = () =>
  (parseInt(process.env.MAX_ATTACHMENT_MB || "3", 10)) * 1024 * 1024;

/** Extension + MIME allowlist for attachments (business documents & images). */
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "txt", "csv", "md", "rtf",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "png", "jpg", "jpeg", "gif",
]);

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "text/",
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.",
  "application/vnd.ms-",
];

export function isAllowedAttachment(filename: string, contentType: string): boolean {
  const ext = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const mime = (contentType || "").toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

/** Strip angle brackets and whitespace from a Message-ID style value. */
export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^<|>$/g, "").trim();
  return trimmed || null;
}

/** Parse a References header into a list of bare Message-IDs. */
export function parseReferences(
  value: string | null | undefined
): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((id) => normalizeMessageId(id))
    .filter((id): id is string => !!id);
}

export interface FileMessageInput {
  clientId: string;
  sender: string;
  recipients: string[];
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  attachments: InboundAttachmentPayload[];
  /** When filing from the review queue, the review item id is recorded. */
  reviewQueueId?: string | null;
}

export interface FileMessageResult {
  message: Message;
  documents: Document[];
}

/**
 * File a verified inbound message to a client record.
 * Resolves the thread, inserts the message, and runs every attachment
 * through the size / type / malware-scan pipeline.
 */
export async function fileInboundMessage(
  input: FileMessageInput
): Promise<FileMessageResult> {
  const supabase = createAdminSupabaseClient();

  // --- Thread resolution: adopt the thread of any referenced message ---
  let threadId = input.messageId;
  const refIds = [input.inReplyTo, ...input.references].filter(
    (id): id is string => !!id
  );
  if (refIds.length > 0) {
    const { data: parent } = await supabase
      .from("messages")
      .select("thread_id")
      .in("message_id", refIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (parent?.thread_id) threadId = parent.thread_id;
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      client_id: input.clientId,
      direction: "inbound",
      sender: input.sender,
      recipients: input.recipients,
      subject: input.subject,
      body_text: input.bodyText,
      body_html: input.bodyHtml,
      message_id: input.messageId,
      in_reply_to: input.inReplyTo,
      references: input.references,
      thread_id: threadId,
      is_read: false,
    })
    .select()
    .single();

  if (messageError) {
    throw new Error(`Failed to file message: ${messageError.message}`);
  }

  // --- Attachment pipeline ---
  const documents: Document[] = [];
  for (const attachment of input.attachments) {
    const doc = await processAttachment(
      attachment,
      input.clientId,
      message.id
    );
    documents.push(doc);
  }

  return { message, documents };
}

/**
 * Run one attachment through the pipeline:
 *   size check → type allowlist → malware scan → storage.
 * Rejected files are recorded (scan_status='rejected') but not stored.
 * Detected malware is stored under quarantine/ and never downloadable.
 */
export async function processAttachment(
  attachment: InboundAttachmentPayload | ReviewQueueAttachment,
  clientId: string,
  messageId: string
): Promise<Document> {
  const supabase = createAdminSupabaseClient();
  const size = attachment.size;

  const base = {
    client_id: clientId,
    message_id: messageId,
    filename: attachment.filename,
    content_type: attachment.content_type,
    size_bytes: size,
  };

  // 1. Size limit
  if (size > MAX_ATTACHMENT_BYTES()) {
    const { data } = await supabase
      .from("documents")
      .insert({
        ...base,
        scan_status: "rejected",
        rejection_reason: `Exceeds maximum attachment size of ${MAX_ATTACHMENT_BYTES() / (1024 * 1024)} MB`,
      })
      .select()
      .single();
    return data as Document;
  }

  // 2. Type allowlist
  if (!isAllowedAttachment(attachment.filename, attachment.content_type)) {
    const { data } = await supabase
      .from("documents")
      .insert({
        ...base,
        scan_status: "rejected",
        rejection_reason: "File type not allowed",
      })
      .select()
      .single();
    return data as Document;
  }

  // 3. Malware scan (requires the payload to carry the bytes)
  if (!("data_base64" in attachment) || !attachment.data_base64) {
    const { data } = await supabase
      .from("documents")
      .insert({
        ...base,
        scan_status: "rejected",
        rejection_reason: "Attachment content unavailable",
      })
      .select()
      .single();
    return data as Document;
  }

  const buffer = Buffer.from(attachment.data_base64, "base64");
  const scan = await scanBuffer(buffer);

  if (scan.detected) {
    // Quarantine: stored, but never downloadable.
    const path = `quarantine/${clientId}/${crypto.randomUUID()}-${attachment.filename}`;
    await putFile(path, buffer, attachment.content_type);
    const { data } = await supabase
      .from("documents")
      .insert({
        ...base,
        storage_path: path,
        scan_status: "quarantined",
        rejection_reason: `Malware detected: ${scan.signatures.join(", ")}`,
      })
      .select()
      .single();
    return data as Document;
  }

  // Clean: store in the client's documents prefix.
  const path = `${clientId}/${crypto.randomUUID()}-${attachment.filename}`;
  await putFile(path, buffer, attachment.content_type);
  const { data } = await supabase
    .from("documents")
    .insert({
      ...base,
      storage_path: path,
      scan_status: "clean",
    })
    .select()
    .single();
  return data as Document;
}

/** Extract SPF/DKIM pass results from Authentication-Results header(s). */
export function checkAuthenticationResults(
  authenticationResults: string | null | undefined
): { spfPass: boolean; dkimPass: boolean; raw: string } {
  const raw = authenticationResults || "";
  if (!raw) {
    // Fail closed: no authentication results means we cannot verify.
    return { spfPass: false, dkimPass: false, raw };
  }
  return {
    spfPass: /(^|;|\s)spf=pass/i.test(raw),
    dkimPass: /(^|;|\s)dkim=pass/i.test(raw),
    raw,
  };
}
