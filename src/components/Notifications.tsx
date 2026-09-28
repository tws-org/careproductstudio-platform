"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UnreadMessage {
  id: string;
  sender: string;
  subject: string | null;
  created_at: string;
  client_id: string;
  client_name: string | null;
}

/**
 * Admin header message icon (Requirement 12):
 * unread count badge + dropdown of "New message from [sender email]".
 * Clicking opens that client's page and marks the message read.
 */
export default function Notifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UnreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/messages?unread=true", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // Leave the list as-is on transient errors; poll again later.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleClick(message: UnreadMessage) {
    setOpen(false);
    // Mark read, then open the client's page.
    try {
      await fetch(`/api/admin/messages/${message.id}/read`, { method: "POST" });
    } catch {
      // Navigation proceeds regardless.
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    router.push(`/admin/clients/${message.client_id}`);
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand"
        aria-label="Messages"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {messages.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {messages.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-brand">
            New messages
          </div>
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              No new messages
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(m)}
                    className="block w-full px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <p className="truncate text-sm font-medium text-gray-800">
                      New message from {m.sender}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {m.subject || "(no subject)"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              href="/admin/review-queue"
              className="text-xs text-brand hover:underline"
              onClick={() => setOpen(false)}
            >
              Review queue →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
