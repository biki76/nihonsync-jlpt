import DOMPurify from "isomorphic-dompurify";

export function sanitizeJlptHtml(dirtyHtml: string): string {
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: ["ruby", "rt", "rp", "u", "p", "br", "strong", "em", "span"],
    ALLOWED_ATTR: ["class"],
  });
}
