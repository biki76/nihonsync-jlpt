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
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* Left Pane (Desktop Sticky) / Top Collapsible Reader (Mobile) */}
      <div className="sticky top-16 z-10 rounded-xl border border-teal-200 bg-white shadow-sm lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#F0FDFA] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E]">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>Reading Passage • 問題 {mondaiNumber}</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#0F766E] shadow-sm lg:hidden"
          >
            <span>{mobileExpanded ? "Collapse" : "Show Passage"}</span>
            {mobileExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div
          className={`${
            mobileExpanded ? "max-h-56 overflow-y-auto p-4" : "hidden"
          } lg:block lg:max-h-none lg:p-5`}
        >
          <JapaneseHtmlText
            html={passageHtml}
            className="space-y-3 text-base text-[#1E293B]"
          />
        </div>
      </div>

      {/* Right Pane: Scrollable Associated Questions */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
