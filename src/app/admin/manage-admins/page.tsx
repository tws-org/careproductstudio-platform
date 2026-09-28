import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export default async function ManageAdminsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");

  const supabase = createAdminSupabaseClient();

  // Get current admins list
  const { data: admins } = await supabase
    .from("admins")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">Manage Admins</h1>
      <p className="mb-6 text-sm text-gray-500">
        Create and manage admin accounts. Only admins can perform these actions.
      </p>

      {/* Create Admin Form */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-brand">Create New Admin</h2>
        <CreateAdminForm />
      </section>

      {/* Current Admins List */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-brand">Current Admins</h2>
        {admins && admins.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created At</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-brand">{admin.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded border bg-white p-6 text-center text-gray-500">
            No admins found.
          </p>
        )}
      </section>
    </div>
  );
}

function CreateAdminForm() {
  return (
    <form action="/api/admin/create-admin" method="POST" className="space-y-4">
      <div>
        <label htmlFor="new-admin-email" className="mb-1 block text-sm font-medium text-gray-700">
          Admin Email
        </label>
        <input
          id="new-admin-email"
          name="email"
          type="email"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          placeholder="admin@example.com"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Create Admin
      </button>
    </form>
  );
}
