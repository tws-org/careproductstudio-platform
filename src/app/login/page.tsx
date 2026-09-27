"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client" | "admin">("client");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setMessage(`Error: ${error.message}`);
      return;
    }

    // Check role match
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
    const isAdminEmail = email.toLowerCase() === adminEmail.toLowerCase();

    if (role === "admin" && !isAdminEmail) {
      await supabase.auth.signOut();
      setLoading(false);
      setMessage("Access denied: this email does not have admin privileges.");
      return;
    }

    if (role === "client" && isAdminEmail) {
      await supabase.auth.signOut();
      setLoading(false);
      setMessage("This email has admin privileges. Please sign in as admin.");
      return;
    }

    // Check if client must change password
    const { data: client } = await supabase
      .from("clients")
      .select("must_change_password")
      .eq("email", email)
      .single();

    setLoading(false);

    if (client?.must_change_password) {
      router.push("/change-password");
      router.refresh();
      return;
    }

    router.push(role === "admin" ? "/admin" : "/client");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand">Care Practice Studio</h1>
          <p className="mt-1 text-sm text-gray-500">Engagement Platform</p>
        </div>

        {/* Role selector */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Sign in as
          </label>
          <div className="flex rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setRole("client")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                role === "client"
                  ? "bg-brand-light text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                role === "admin"
                  ? "bg-brand text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "Signing in..." : `Sign In as ${role === "admin" ? "Admin" : "Client"}`}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
}
