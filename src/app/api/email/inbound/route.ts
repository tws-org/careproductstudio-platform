import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  checkAuthenticationResults,
  fileInboundMessage,
  normalizeMessageId,
  parseReferences,
} from "@/lib/email-file";
import type { InboundEmailPayload } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Inbound email webhook (Requirement 9–10).
 *
 * Called by the Cloudflare Email Worker for every message sent to
 * request@carepracticestudio.com. Authenticated by an HMAC-SHA256
 * signature over the raw request body (secret shared with the worker).
 *
 * Filing decision (Requirement 10): file to a client only when ALL of
 * these hold — sender matches a registered address, SPF and DKIM pass,
 * and the client's waiver is signed. Anything else is held in the
 * review queue, never auto-filed.
 */
export async function POST(request: Request) {
  // --- 1. Authenticate the caller (HMAC over the raw body) ---
  const signature = request.headers.get("x-webhook-signature");
  const rawBody = await request.text();

  const secret = process.env.EMAIL_WEBHOOK_SECRET || "";
  if (!secret || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // --- 2. Parse the payload ---
  let payload: InboundEmailPayload;
  try {
    payload = JSON.parse(rawBody) as InboundEmailPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const sender = (payload.from || "").toLowerCase().trim();
  const recipients = [payload.to].filter(Boolean) as string[];
  const messageId = normalizeMessageId(payload.headers?.["message-id"]);
  const inReplyTo = normalizeMessageId(payload.headers?.["in-reply-to"]);
  const references = parseReferences(payload.headers?.references);

  // --- 3. Sender verification: registered address? ---
  const { data: registration } = await supabase
    .from("client_email_addresses")
    .select("client_id, clients(waiver_signed)")
    .eq("email", sender)
    .maybeSingle();

  const clientsField: unknown = registration?.clients;
  const waiverSigned = Array.isArray(clientsField)
    ? (clientsField as Array<{ waiver_signed: boolean | null }>)[0]?.waiver_signed
    : (clientsField as { waiver_signed: boolean | null } | null)
        ?.waiver_signed;

  // --- 4. SPF / DKIM verification (fail closed) ---
  const authResults = [
    payload.headers?.["authentication-results"],
    payload.headers?.["arc-authentication-results"],
  ]
    .filter((v): v is string => !!v)
    .join("\n");
  const { spfPass, dkimPass } = checkAuthenticationResults(authResults);

  // --- 5. Collect every failing reason ---
  const reasons: string[] = [];
  if (!registration) reasons.push("unregistered sender");
  if (registration && !waiverSigned) {
    reasons.push("client waiver not signed");
  }
  if (!spfPass || !dkimPass) {
    reasons.push(
      `SPF/DKIM check failed (spf=${spfPass ? "pass" : "fail"}, dkim=${dkimPass ? "pass" : "fail"})`
    );
  }

  // --- 6. File or hold for review ---
  if (reasons.length > 0) {
    const { data: reviewItem, error: reviewError } = await supabase
      .from("review_queue")
      .insert({
        reason: reasons.join("; "),
        sender,
        recipients,
        subject: payload.subject,
        headers: {
          "message-id": messageId,
          "in-reply-to": inReplyTo,
          references,
          "authentication-results": authResults || null,
          "dkim-signature": payload.headers?.["dkim-signature"] || null,
        },
        body_text: payload.text,
        body_html: payload.html,
        attachments: payload.attachments,
        status: "pending",
      })
      .select()
      .single();

    if (reviewError) {
      // Never lose mail: the worker has already forwarded it to Peter's
      // inbox, so log and acknowledge.
      console.error("Failed to write review queue item:", reviewError);
      return NextResponse.json(
        { filed: false, error: "review queue write failed", detail: reviewError.message },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { filed: false, review_id: reviewItem.id, reason: reviewItem.reason },
      { status: 200 }
    );
  }

  // --- 7. File to the client ---
  try {
    const { message } = await fileInboundMessage({
      clientId: registration!.client_id,
      sender,
      recipients,
      subject: payload.subject,
      bodyText: payload.text,
      bodyHtml: payload.html,
      messageId,
      inReplyTo,
      references,
      attachments: payload.attachments,
    });

    return NextResponse.json(
      { filed: true, message_id: message.id, thread_id: message.thread_id },
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to file inbound message:", err);
    // The worker forwards to Peter's inbox regardless, so acknowledge to
    // avoid worker-side retries; the mail is not lost.
    return NextResponse.json(
      { filed: false, error: "filing failed", detail: String(err) },
      { status: 200 }
    );
  }
}
