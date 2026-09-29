import PostalMime from "postal-mime";

/**
 * Care Practice Studio — inbound email worker (Slice A).
 *
 * For every email sent to request@carepracticestudio.com:
 *   1. Forwards the original message to Peter's inbox (his phone keeps
 *      alerting, exactly as with the existing help@ forwarding).
 *   2. Parses the message (MIME, headers, attachments) and POSTs it to
 *      the platform webhook with an HMAC signature. The platform then
 *      files it to the client or holds it for review.
 *
 * No DNS / MX / email-routing changes are needed: the routing rule is
 * "Send to a Worker" for request@, created by wrangler (see
 * EMAIL_INTAKE.md). The existing help@ forwarding is untouched.
 */

interface Env {
  FORWARD_TO: string;
  INBOUND_WEBHOOK_URL: string;
  INBOUND_WEBHOOK_SECRET: string;
  MAX_ATTACHMENT_MB: string;
}

const MAX_ATTACHMENT_BYTES = (env: Env) =>
  ((parseInt(env.MAX_ATTACHMENT_MB || "3", 10)) || 3) * 1024 * 1024;

export default {
  async email(message, env, ctx): Promise<void> {
    // 1. Forward to Peter's inbox FIRST — his inbox must always get the
    //    mail, even if the platform webhook is down.
    const forwardPromise = message.forward(env.FORWARD_TO);

    // 2. Hand off to the platform (non-blocking; failures are logged).
    const platformPromise = forwardToPlatform(message, env).catch((err) => {
      console.error("Platform handoff failed (mail still forwarded):", err);
    });

    await forwardPromise;
    ctx.waitUntil(platformPromise);
  },
} satisfies ExportedHandler<Env>;

async function forwardToPlatform(
  message: ForwardableEmailMessage,
  env: Env
): Promise<void> {
  const parsed = await PostalMime.parse(message.raw);

  // --- Collect headers (preserving duplicates, e.g. multiple
  //     Authentication-Results stamps) ---
  const headerMap = new Map<string, string[]>();
  for (const h of parsed.headers) {
    const key = h.key.toLowerCase();
    const list = headerMap.get(key) || [];
    list.push(h.value);
    headerMap.set(key, list);
  }
  const headers: Record<string, string> = {};
  for (const [key, values] of headerMap) {
    headers[key] = values.join("\n");
  }

  // --- Attachments (base64). Skip oversized files — Peter still has
  //     them in his inbox via the forward. ---
  const maxBytes = MAX_ATTACHMENT_BYTES(env);
  const attachments: Array<{
    filename: string;
    content_type: string;
    size: number;
    data_base64: string;
  }> = [];
  const skipped: string[] = [];

  for (const att of parsed.attachments || []) {
    const buf = att.content;
    if (buf.byteLength > maxBytes) {
      skipped.push(`${att.filename} (${buf.byteLength} bytes)`);
      continue;
    }
    attachments.push({
      filename: att.filename || "attachment",
      content_type: att.mimeType || "application/octet-stream",
      size: buf.byteLength,
      data_base64: arrayBufferToBase64(buf),
    });
  }
  if (skipped.length > 0) {
    console.warn(`Skipped oversized attachments: ${skipped.join(", ")}`);
  }

  const payload = {
    from: addressOf(parsed.from) || message.from,
    envelope_from: message.from,
    to: (parsed.to || []).map(addressOf).filter(Boolean).join(", ") || message.to,
    subject: parsed.subject || null,
    date: parsed.date || null,
    headers,
    text: parsed.text || null,
    html: parsed.html || null,
    attachments,
  };

  // --- HMAC-SHA256 signature over the raw JSON body ---
  const body = JSON.stringify(payload);
  const signature = await hmacSha256Hex(env.INBOUND_WEBHOOK_SECRET, body);

  const response = await fetch(env.INBOUND_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": `sha256=${signature}`,
      "X-Webhook-Source": "cps-email-worker",
    },
    body,
  });

  const result = await response.text().catch(() => "");
  console.log(
    `Platform response ${response.status} for message ${headers["message-id"] || "(no id)"}: ${result.slice(0, 500)}`
  );

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

function addressOf(addr: unknown): string | null {
  if (!addr) return null;
  if (typeof addr === "string") return addr;
  if (typeof addr === "object" && "address" in addr) {
    return String((addr as { address: unknown }).address);
  }
  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
