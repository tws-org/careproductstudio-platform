import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminSupabaseClient, isAdminEmail } from "@/lib/supabase-admin";
import { sanitizeEmailHtml } from "@/lib/email-sanitize";
import FileToClientForm from "./FileToClientForm";
import DiscardButton from "./DiscardButton";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Review-queue detail: inspect a held message (headers, body,
 * attachments) and either file it to a client or discard it.
 */
export default async function ReviewQueueDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/unauthorized");

  const supabase = createAdminSupabaseClient();

  const { data: item } = await supabase
    .from("review_queue")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!item) notFound();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("created_at", { ascending: true });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  const attachments = (item.attachments || []) as Array<{
    filename: string;
    content_type: string;
    size: number;
    data_base64?: string;
  }>;

  const headers = (item.headers || {}) as Record<string, unknown>;
  const authResults = [
    headers["authentication-results"],
    headers["arc-authentication-results"],
  ]
    .filter((v): v is string => !!v)
    .join("\n");

  return (
    <div>
      <Link
        href="/admin/review-queue"
        className="mb-4 inline-block text-sm text-brand hover:underline"
      >
        &larr; Review Queue
      </Link>

      <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-5">
        <p className="text-sm font-medium text-yellow-900">
          Held for review: {item.reason}
        </p>
        <p className="mt-1 text-xs text-yellow-700">
          This message was not filed to any client automatically.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">From</dt>
            <dd className="mt-0.5 text-gray-800">{item.sender}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">To</dt>
            <dd className="mt-0.5 text-gray-800">{(item.recipients || []).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Subject</dt>
            <dd className="mt-0.5 text-gray-800">{item.subject || "(no subject)"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Received</dt>
            <dd className="mt-0.5 text-gray-800">{new Date(item.created_at).toLocaleString()}</dd>
          </div>
          {authResults && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Authentication results
              </dt>
              <dd className="mt-0.5 break-all rounded bg-gray-50 p-2 text-xs text-gray-600">
                {authResults}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium text-brand">Message body</h2>
        {item.body_html ? (
          <div
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700"
            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(item.body_html) }}
          />
        ) : item.body_text ? (
          <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-4 py-3 font-serif text-sm text-gray-700">
            {item.body_text}
          </p>
        ) : (
          <p className="text-sm italic text-gray-400">(empty message)</p>
        )}
      </section>

      {attachments.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-medium text-brand">
            Attachments ({attachments.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">File</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Size</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((a, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3 text-gray-800">{a.filename}</td>
                    <td className="px-4 py-3 text-gray-500">{a.content_type}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {(a.size / 1024).toFixed(1)} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {item.status === "pending" && (
        <section className="grid gap-4 md:grid-cols-2">
          <FileToClientForm
            reviewItemId={item.id}
            clients={(clients || []) as Array<{ id: string; name: string }>}
            projects={(projects || []) as Array<{ id: string; name: string }>}
          />
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-2 text-lg font-medium text-brand">Discard</h2>
            <p className="mb-4 text-sm text-gray-500">
              Remove this item from the queue without filing it anywhere.
              The original email is still in Peter&apos;s inbox (the worker
              forwards everything).
            </p>
            <DiscardButton reviewItemId={item.id} />
          </div>
        </section>
      )}
    </div>
  );
}
