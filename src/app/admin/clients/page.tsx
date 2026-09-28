import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Client } from "@/lib/types";

export default async function AdminClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/unauthorized");

  const supabase = createAdminSupabaseClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  const clientList = (clients || []) as Client[];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">Clients</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manage client records and waiver status.
      </p>

      {clientList.length === 0 ? (
        <p className="rounded border bg-white p-6 text-center text-gray-500">
          No clients yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Waiver Signed</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Waiver Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Added</th>
              </tr>
            </thead>
            <tbody>
              {clientList.map((client) => (
                <tr key={client.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-brand">{client.name}</td>
                  <td className="px-4 py-3 text-gray-500">{client.email}</td>
                  <td className="px-4 py-3">
                    {client.waiver_signed ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Yes
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {client.waiver_signed_at
                      ? new Date(client.waiver_signed_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
