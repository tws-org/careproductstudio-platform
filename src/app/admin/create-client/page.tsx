import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function CreateClientPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">Create Client Account</h1>
      <p className="mb-6 text-sm text-gray-500">
        Create a new client account. Only admins can perform this action.
      </p>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <form action="/api/admin/create-client" method="POST" className="space-y-4">
          <div>
            <label htmlFor="client-name" className="mb-1 block text-sm font-medium text-gray-700">
              Client Name
            </label>
            <input
              id="client-name"
              name="name"
              type="text"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="e.g. Jess Rebelo"
            />
          </div>

          <div>
            <label htmlFor="client-email" className="mb-1 block text-sm font-medium text-gray-700">
              Client Email
            </label>
            <input
              id="client-email"
              name="email"
              type="email"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="client@example.com"
            />
          </div>

          <div>
            <label htmlFor="client-password" className="mb-1 block text-sm font-medium text-gray-700">
              Temporary Password
            </label>
            <input
              id="client-password"
              name="password"
              type="password"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Set a temporary password"
            />
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Note:</strong> The client will use this email and password to sign in.
            They will only see their own projects and data.
          </div>

          <button
            type="submit"
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Create Client Account
          </button>
        </form>
      </section>
    </div>
  );
}
