import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (server components / route handlers ONLY).
 *
 * Bypasses Row Level Security. Every caller must perform its own
 * authorization check (e.g. requireAdminEmail) — never expose this
 * client to the browser.
 */
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Returns true when the given email is the configured admin (Peter). */
export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || "";
  return !!email && email.toLowerCase() === adminEmail.toLowerCase();
}
