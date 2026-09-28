import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth";
import {
  fileInboundMessage,
  normalizeMessageId,
  parseReferences,
} from "@/lib/email-file";
import type { InboundAttachmentPayload } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Review-queue actions (Requirement 10): Peter approves (files to a
 * client) or discards held mail. Admin only.
 */

async function getReviewItem(supabase: ReturnType<typeof createAdminSupabaseClient>, id: string) {
  const { data, error } = await supabase
    .from("review_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** POST /api/admin/review-queue/[id]/file  { client_id, project_id? } */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    client_id?: string;
    project_id?: string;
  };
  if (!body.client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const item = await getReviewItem(supabase, params.id);
  if (!item) {
    return NextResponse.json({ error: "Review item not found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: `Item already ${item.status}` },
      { status: 409 }
    );
  }

  // Verify the target client exists
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", body.client_id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const headers = (item.headers || {}) as Record<string, unknown>;
  const attachments: InboundAttachmentPayload[] = ((item.attachments as InboundAttachmentPayload[]) || []).map(
    (a) => ({
      filename: a.filename,
      content_type: a.content_type,
      size: a.size,
      data_base64: a.data_base64 || "",
    })
  );

  try {
    const { message } = await fileInboundMessage({
      clientId: body.client_id,
      sender: item.sender,
      recipients: item.recipients || [],
      subject: item.subject,
      bodyText: item.body_text,
      bodyHtml: item.body_html,
      messageId: normalizeMessageId(headers["message-id"] as string),
      inReplyTo: normalizeMessageId(headers["in-reply-to"] as string),
      references: parseReferences(headers["references"] as string),
      attachments,
      reviewQueueId: item.id,
    });

    // If a project was chosen, link the message to it
    if (body.project_id) {
      await supabase
        .from("messages")
        .update({ project_id: body.project_id })
        .eq("id", message.id);
    }

    await supabase
      .from("review_queue")
      .update({
        status: "filed",
        filed_client_id: body.client_id,
        filed_message_id: message.id,
        reviewed_by: user.id,
      })
      .eq("id", item.id);

    return NextResponse.json({ success: true, message_id: message.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE /api/admin/review-queue/[id] — discard a held item */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const item = await getReviewItem(supabase, params.id);
  if (!item) {
    return NextResponse.json({ error: "Review item not found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: `Item already ${item.status}` },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("review_queue")
    .update({ status: "discarded", reviewed_by: user.id })
    .eq("id", item.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
