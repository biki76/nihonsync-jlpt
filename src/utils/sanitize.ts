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

const VOID_TAGS = new Set(["br"]);
const SAFE_CLASS_PATTERN = /^[a-zA-Z0-9 _-]+$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractSafeClassAttribute(rawAttrs: string): string {
  const classMatch = rawAttrs.match(
    /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
  );
  if (!classMatch) return "";
  const rawValue = (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? "").trim();
  if (!rawValue || !SAFE_CLASS_PATTERN.test(rawValue)) return "";
  return ` class="${escapeHtml(rawValue)}"`;
}

/**
 * Deterministic state-machine HTML tokenizer for JLPT prompts & passages.
 * Strips all unapproved tags, event handlers, styles, and malformed nested tags
 * without requiring jsdom inside Next.js Turbopack bundles.
 */
export function sanitizeJlptHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  const output: string[] = [];
  const openStack: string[] = [];
  let cursor = 0;
  const len = dirtyHtml.length;

  while (cursor < len) {
    const ltIndex = dirtyHtml.indexOf("<", cursor);
    if (ltIndex === -1) {
      output.push(escapeHtml(dirtyHtml.slice(cursor)));
      break;
    }

    if (ltIndex > cursor) {
      output.push(escapeHtml(dirtyHtml.slice(cursor, ltIndex)));
    }

    const gtIndex = dirtyHtml.indexOf(">", ltIndex + 1);
    if (gtIndex === -1) {
      output.push(escapeHtml(dirtyHtml.slice(ltIndex)));
      break;
    }

    const rawInside = dirtyHtml.slice(ltIndex + 1, gtIndex);
    // Guard against nested '<' inside a malformed tag such as '<<script>'
    const nestedLt = rawInside.lastIndexOf("<");
    if (nestedLt !== -1) {
      output.push(escapeHtml(dirtyHtml.slice(ltIndex, ltIndex + 1 + nestedLt)));
      cursor = ltIndex + 1 + nestedLt;
      continue;
    }

    const trimmed = rawInside.trim();
    const isClosing = trimmed.startsWith("/");
    const withoutSlash = isClosing ? trimmed.slice(1).trim() : trimmed;
    const isSelfClosing = !isClosing && withoutSlash.endsWith("/");
    const cleanBody = isSelfClosing
      ? withoutSlash.slice(0, -1).trim()
      : withoutSlash;

    const spaceIdx = cleanBody.search(/\s/);
    const tagName = (
      spaceIdx === -1 ? cleanBody : cleanBody.slice(0, spaceIdx)
    ).toLowerCase();
    const rawAttrs = spaceIdx === -1 ? "" : cleanBody.slice(spaceIdx + 1);

    if (ALLOWED_TAGS.has(tagName)) {
      if (isClosing) {
        const stackIdx = openStack.lastIndexOf(tagName);
        if (stackIdx !== -1) {
          while (openStack.length > stackIdx) {
            const popped = openStack.pop()!;
            output.push(`</${popped}>`);
          }
        }
      } else if (VOID_TAGS.has(tagName)) {
        output.push(`<${tagName} />`);
      } else {
        const safeClass = extractSafeClassAttribute(rawAttrs);
        output.push(`<${tagName}${safeClass}>`);
        if (!isSelfClosing) {
          openStack.push(tagName);
        } else {
          output.push(`</${tagName}>`);
        }
      }
    }

    cursor = gtIndex + 1;
  }

  while (openStack.length > 0) {
    output.push(`</${openStack.pop()!}>`);
  }

  return output.join("");
}
