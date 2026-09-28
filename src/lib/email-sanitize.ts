import sanitizeHtml from "sanitize-html";

/**
 * Sanitized rendering of inbound email HTML (Requirement 14).
 *
 * - No script execution: script/style/iframe/object/embed/form tags are
 *   stripped entirely, as are event-handler attributes.
 * - No remote content: <img> is not in the allowlist, so remote images
 *   and tracking pixels are not loaded. Links (<a href>) are kept only
 *   for http/https/mailto — they load nothing until clicked.
 */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: [
      "a", "abbr", "article", "b", "bdi", "bdo", "blockquote", "br", "caption",
      "cite", "code", "col", "colgroup", "dd", "del", "details", "dfn", "div",
      "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3",
      "h4", "h5", "h6", "header", "hr", "i", "ins", "kbd", "li", "main", "mark",
      "ol", "p", "pre", "q", "rp", "rt", "ruby", "s", "samp", "section",
      "small", "span", "strike", "strong", "sub", "summary", "sup", "table",
      "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "wbr",
    ],
    allowedAttributes: {
      a: ["href", "name", "title"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      time: ["datetime"],
      ol: ["start", "type"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {},
    disallowedTagsMode: "discard",
    // Strip style attributes and any leftover dangerous protocols.
    allowProtocolRelative: false,
  });
}
