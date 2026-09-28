import { NextResponse } from "next/server";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import { createSignedUrl } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/documents/[id]/download
 * Download link for a document. Only files that passed the malware scan
 * (scan_status='clean') can be downloaded; quarantined/rejected files
 * are never served. Admin only (Slice C adds client access).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, filename, storage_path, scan_status")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.scan_status !== "clean" || !doc.storage_path) {
    return NextResponse.json(
      { error: "This file is not available for download" },
      { status: 403 }
    );
  }

  const url = await createSignedUrl(doc.storage_path, 300);
  return NextResponse.redirect(url);
}
