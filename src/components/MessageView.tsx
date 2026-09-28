import { sanitizeEmailHtml } from "@/lib/email-sanitize";
import type { Message } from "@/lib/types";

/**
 * Renders one email message safely (Requirement 14):
 * HTML bodies are sanitized (no script execution, no remote content);
 * text bodies are rendered as escaped React text.
 */
export default function MessageView({ message }: { message: Message }) {
  const hasHtml = !!message.body_html && message.body_html.trim().length > 0;
  const hasText = !!message.body_text && message.body_text.trim().length > 0;

  return (
    <article className="rounded-lg border border-gray-200 bg-white">
      <header className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-medium text-gray-800">
            {message.subject || "(no subject)"}
          </h3>
          <time className="shrink-0 text-xs text-gray-400">
            {new Date(message.created_at).toLocaleString()}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          From: <span className="font-medium">{message.sender}</span>
          {message.recipients.length > 0 && (
            <> &middot; To: {message.recipients.join(", ")}</>
          )}
        </p>
      </header>

      <div className="px-4 py-3">
        {hasHtml ? (
          <div
            className="email-body prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{
              __html: sanitizeEmailHtml(message.body_html),
            }}
          />
        ) : hasText ? (
          <p className="whitespace-pre-wrap font-serif text-sm text-gray-700">
            {message.body_text}
          </p>
        ) : (
          <p className="text-sm italic text-gray-400">(empty message)</p>
        )}
      </div>
    </article>
  );
}
