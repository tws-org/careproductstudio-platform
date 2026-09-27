"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mustChange, setMustChange] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkMustChangePassword();
  }, []);

  async function checkMustChangePassword() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: client } = await supabase
      .from("clients")
      .select("must_change_password")
      .eq("email", user.email)
      .single();

    if (!client?.must_change_password) {
      // No need to change password, redirect to appropriate dashboard
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
      const isAdmin = user.email?.toLowerCase() === adminEmail.toLowerCase();
      router.push(isAdmin ? "/admin" : "/client");
      return;
    }

    setMustChange(true);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setLoading(false);
      setMessage(`Error: ${error.message}`);
      return;
    }

    // Clear the must_change_password flag
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    await supabase
      .from("clients")
      .update({ must_change_password: false })
      .eq("email", currentUser?.email);

    setLoading(false);
    setMessage("Password updated successfully. Redirecting...");

    // Redirect after a brief delay
    setTimeout(() => {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
      const isAdmin = (supabase.auth.getUser() as any)?.email?.toLowerCase() === adminEmail.toLowerCase();
      router.push(isAdmin ? "/admin" : "/client");
      router.refresh();
    }, 1500);
  }

  if (!mustChange) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand">Change Your Password</h1>
          <p className="mt-1 text-sm text-gray-500">
            You must change your temporary password before continuing.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
}
