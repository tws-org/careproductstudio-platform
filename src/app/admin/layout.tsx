import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import Notifications from "@/components/Notifications";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-bold text-brand">
              Care Practice Studio
            </Link>
            <span className="text-sm text-gray-400">/</span>
            <nav className="flex gap-4 text-sm">
              <Link href="/admin" className="text-gray-500 hover:text-brand">
                Overview
              </Link>
              <Link href="/admin/clients" className="text-gray-500 hover:text-brand">
                Clients
              </Link>
              <Link href="/admin/projects" className="text-gray-500 hover:text-brand">
                All Projects
              </Link>
              <Link href="/admin/manage-admins" className="text-gray-500 hover:text-brand">
                Manage Admins
              </Link>
              <Link href="/admin/create-client" className="text-gray-500 hover:text-brand">
                Create Client
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Notifications />
            <span className="text-sm text-gray-500">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
