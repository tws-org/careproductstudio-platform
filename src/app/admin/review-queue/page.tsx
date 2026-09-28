import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Review queue (Requirement 10): inbound mail that could not be safely
 * filed — unregistered senders, failed SPF/DKIM, unsigned waivers.
 * Peter approves (files to a client) or discards each item.
 */
export default async function ReviewQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/unauthorized");

  const supabase = createAdminSupabaseClient();

  const { data: items } = await supabase
    .from("review_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  const pending = (items || []) as NonNullable<typeof items>;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand">Review Queue</h1>
      <p className="mb-6 text-sm text-gray-500">
        Inbound mail that could not be filed automatically. Nothing here is
        attached to a client until you file it.
      </p>

      {pending.length === 0 ? (
        <p className="rounded border bg-white p-6 text-center text-gray-500">
          Queue is clear.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pending.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.sender}</td>
                  <td className="px-4 py-3 text-gray-600">{item.subject || "(no subject)"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {item.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/review-queue/${item.id}`}
                      className="text-sm text-brand hover:underline"
                    >
                      Review →
                    </Link>
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
