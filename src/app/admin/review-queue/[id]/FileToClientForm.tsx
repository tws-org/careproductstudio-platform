"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FileToClientForm({
  reviewItemId,
  clients,
  projects,
}: {
  reviewItemId: string;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/review-queue/${reviewItemId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        project_id: projectId || undefined,
      }),
    });

    setBusy(false);

    if (res.ok) {
      router.push(`/admin/clients/${clientId}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to file message");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-5"
    >
      <h2 className="mb-2 text-lg font-medium text-brand">File to client</h2>
      <p className="mb-4 text-sm text-gray-500">
        File this message to a client record. Attachments are re-checked
        against the size, type, and malware rules.
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-700">
        Client
      </label>
      <select
        required
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">Select a client…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-sm font-medium text-gray-700">
        Project (optional)
      </label>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy || !clientId}
        className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Filing…" : "File message"}
      </button>
    </form>
  );
}
