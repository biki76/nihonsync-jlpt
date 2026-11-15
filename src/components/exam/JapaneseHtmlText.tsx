"use client";

import { useMemo } from "react";
import { sanitizeJlptHtml } from "@/utils/sanitize";

interface JapaneseHtmlTextProps {
  html: string;
  className?: string;
  as?: "div" | "span" | "p";
}

export function JapaneseHtmlText({
  html,
  className = "",
  as: Tag = "div",
}: JapaneseHtmlTextProps) {
  const cleanHtml = useMemo(() => sanitizeJlptHtml(html), [html]);

  return (
    <Tag
      className={`jp-furigana [&_u]:underline [&_u]:underline-offset-4 [&_u]:decoration-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
