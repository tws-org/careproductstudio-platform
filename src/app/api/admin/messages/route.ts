import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/messages?unread=true
 * Unread inbound message count + latest messages for the header
 * dropdown (Requirement 12). Admin only.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("messages")
    .select(
      "id, sender, subject, created_at, client_id, clients(name)"
    )
    .eq("direction", "inbound")
    .order("created_at", { ascending: false });

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data: messages, error } = await query.limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (messages || []) as unknown as Array<{
    id: string;
    sender: string;
    subject: string | null;
    created_at: string;
    client_id: string;
    clients: { name: string } | null;
  }>;

  // Total unread count (not limited to the 10 shown in the dropdown)
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("direction", "inbound")
    .eq("is_read", false);

  return NextResponse.json({
    count: count ?? 0,
    messages: list.map((m) => ({
      id: m.id,
      sender: m.sender,
      subject: m.subject,
      created_at: m.created_at,
      client_id: m.client_id,
      client_name: m.clients?.name || null,
    })),
  });
}
