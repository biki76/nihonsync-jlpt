"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { JapaneseHtmlText } from "@/components/exam/JapaneseHtmlText";

interface ReadingSplitPaneProps {
  mondaiNumber: number;
  passageHtml: string;
  children: ReactNode;
}

export function ReadingSplitPane({
  mondaiNumber,
  passageHtml,
  children,
}: ReadingSplitPaneProps) {
  const [mobileExpanded, setMobileExpanded] = useState(true);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      {/* Normal document flow on mobile so it NEVER overlaps question cards; sticky side-pane on lg+ */}
      <div className="relative z-0 rounded-xl border border-teal-200 bg-white shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#F0FDFA] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E]">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>問題 {mondaiNumber} • Instructions / Passage</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F766E] shadow-xs ring-1 ring-teal-200/70 lg:hidden"
          >
            <span>{mobileExpanded ? "Hide" : "Show"}</span>
            {mobileExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div
          className={`${
            mobileExpanded ? "block p-4" : "hidden"
          } lg:block lg:p-5`}
        >
          <JapaneseHtmlText
            html={passageHtml}
            className="space-y-3 text-base leading-relaxed text-[#1E293B]"
          />
        </div>
      </div>

      {/* Scrollable Associated Questions */}
      <div className="relative z-0 space-y-5">{children}</div>
    </div>
  );
}
