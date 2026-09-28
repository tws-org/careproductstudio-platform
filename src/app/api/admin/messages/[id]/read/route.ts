import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/messages/[id]/read
 * Mark a message as read (Requirement 12: clicking a notification
 * opens the client's page and clears the unread state). Admin only.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
