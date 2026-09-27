import { createServerSupabaseClient } from "./supabase-server";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const adminEmail = process.env.ADMIN_EMAIL || "";
  const isAdmin = user.email.toLowerCase() === adminEmail.toLowerCase();

  return {
    id: user.id,
    email: user.email,
    isAdmin,
  };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new Error("Forbidden");
  }
  return user;
}
