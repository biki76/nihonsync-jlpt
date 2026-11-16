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
      <div className="sticky top-16 z-10 rounded-[16px] border border-[#E04F33]/35 bg-white shadow-xs dark:bg-[#18181B] lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E6E2DA] bg-[#FDF2EF] px-4 py-2.5 dark:border-[#2E2E32] dark:bg-[#E04F33]/15">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E04F33]">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>Reading Passage • 問題 {mondaiNumber}</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#E04F33] shadow-xs dark:bg-[#18181B] lg:hidden"
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
            className="space-y-3 text-base text-[#18181B] dark:text-[#F4F4F5]"
          />
        </div>
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  );
}
