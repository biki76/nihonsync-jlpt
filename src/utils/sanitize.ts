const ALLOWED_TAGS = new Set([
  "ruby",
  "rt",
  "rp",
  "u",
  "p",
  "br",
  "strong",
  "em",
  "span",
]);

export function sanitizeJlptHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return "";

  // 1. Strip script, style, iframe, object, embed, and svg blocks completely
  let cleaned = dirtyHtml.replace(
    /<\s*(script|style|iframe|object|embed|svg)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );

  // 2. Filter all remaining HTML tags against the strict JLPT allowlist
  cleaned = cleaned.replace(
    /<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g,
    (_match, slash: string, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        return "";
      }
      if (slash === "/") {
        return `</${tag}>`;
      }
      if (tag === "br") {
        return "<br />";
      }
      const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i);
      const safeClass = classMatch
        ? ` class="${classMatch[1].replace(/[^a-zA-Z0-9 _-]/g, "")}"`
        : "";
      return `<${tag}${safeClass}>`;
    }
  );

  return cleaned;
}
