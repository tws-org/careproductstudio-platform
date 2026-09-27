import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  // Check if current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "";
  const isAdmin = user.email?.toLowerCase() === adminEmail.toLowerCase();

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Create client record with must_change_password = true
  const { error: clientError } = await supabase.from("clients").insert({
    name,
    email,
    waiver_signed: false,
    waiver_signed_at: null,
    must_change_password: true,
  });

  if (clientError) {
    // Rollback: delete the auth user if client creation failed
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
