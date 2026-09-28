import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import MessageView from "@/components/MessageView";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin client page (Slice A version — Slice B expands this into the
 * full working canvas with scratch workspace, tasks, notes, and reply).
 *
 * Opens from the header message notification: shows the client's info,
 * their threaded message history, and documents (including email
 * attachments filed to this client).
 */
export default async function AdminClientPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/unauthorized");

  const supabase = createAdminSupabaseClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!client) notFound();

  const { data: addresses } = await supabase
    .from("client_email_addresses")
    .select("email")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const messageList = (messages || []) as NonNullable<typeof messages>;
  const documentList = (documents || []) as NonNullable<typeof documents>;

  // Group messages by thread (thread_id = root Message-ID). Ungrouped
  // messages (no thread) each render standalone.
  const threads = new Map<string, typeof messageList>();
  const unthreaded: typeof messageList = [];
  for (const m of messageList) {
    if (m.thread_id) {
      const list = threads.get(m.thread_id) || [];
      list.push(m);
      threads.set(m.thread_id, list);
    } else {
      unthreaded.push(m);
    }
  }
  const threadList = Array.from(threads.values()).sort(
    (a, b) =>
      new Date(a[0].created_at).getTime() -
      new Date(b[0].created_at).getTime()
  );

  return (
    <div>
      <Link
        href="/admin/clients"
        className="mb-4 inline-block text-sm text-brand hover:underline"
      >
        &larr; All Clients
      </Link>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand">{client.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{client.email}</p>
          </div>
          {client.waiver_signed ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Waiver signed
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              Waiver not signed
            </span>
          )}
        </div>
        {addresses && addresses.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Registered sender addresses
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {addresses.map((a) => (
                <span
                  key={a.email}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                >
                  {a.email}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-medium text-brand">Messages</h2>
        {threadList.length === 0 && unthreaded.length === 0 ? (
          <p className="rounded border bg-white p-6 text-center text-gray-500">
            No messages yet.
          </p>
        ) : (
          <div className="space-y-6">
            {threadList.map((thread) => (
              <div key={thread[0].thread_id} className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Thread {thread.length > 1 ? `(${thread.length} messages)` : ""}
                </p>
                {thread.map((m) => (
                  <MessageView key={m.id} message={m} />
                ))}
              </div>
            ))}
            {unthreaded.map((m) => (
              <MessageView key={m.id} message={m} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-brand">Documents</h2>
        {documentList.length === 0 ? (
          <p className="rounded border bg-white p-6 text-center text-gray-500">
            No documents yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">File</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Size</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Scan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Received</th>
                </tr>
              </thead>
              <tbody>
                {documentList.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {doc.scan_status === "clean" ? (
                        <Link
                          href={`/api/admin/documents/${doc.id}/download`}
                          className="text-brand hover:underline"
                        >
                          {doc.filename}
                        </Link>
                      ) : (
                        <span className="text-gray-700">{doc.filename}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.content_type}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {(doc.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-4 py-3">
                      {doc.scan_status === "clean" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Clean
                        </span>
                      )}
                      {doc.scan_status === "quarantined" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Quarantined
                        </span>
                      )}
                      {doc.scan_status === "rejected" && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Rejected
                        </span>
                      )}
                      {doc.scan_status === "pending" && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Pending
                        </span>
                      )}
                      {doc.rejection_reason && (
                        <p className="mt-1 text-xs text-gray-400">{doc.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
