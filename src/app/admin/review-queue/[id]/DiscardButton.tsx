"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DiscardButton({ reviewItemId }: { reviewItemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDiscard() {
    if (!confirm("Discard this item? It will not be filed to any client.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/review-queue/${reviewItemId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      router.push("/admin/review-queue");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleDiscard}
      disabled={busy}
      className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {busy ? "Discarding…" : "Discard"}
    </button>
  );
}
