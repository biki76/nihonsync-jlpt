"use client";

import { Star } from "lucide-react";
import { JapaneseHtmlText } from "@/components/exam/JapaneseHtmlText";
import type { QuestionOption } from "@/types/jlpt";

interface StarQuestionDisplayProps {
  promptHtml: string;
  options: QuestionOption[];
  selectedOption: number | null;
}

export function StarQuestionDisplay({
  promptHtml,
  options,
  selectedOption,
}: StarQuestionDisplayProps) {
  const chosenOpt =
    options.find((opt) => opt.index === selectedOption) ?? null;

  return (
    <div className="mt-3 space-y-3">
      <JapaneseHtmlText
        html={promptHtml}
        className="text-base font-medium text-[#1E293B] sm:text-lg"
      />

      {/* Visual 4-Slot Horizontal Breakdown Highlighting the ★ Target Slot */}
      <div className="rounded-xl border border-amber-200 bg-[#FFFBEB]/60 p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
          <Star className="h-3.5 w-3.5 fill-[#D97706]" />
          <span>Word Order Assembly — Select Option for Slot 3 (★)</span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((slot) => {
            const isStarSlot = slot === 3;

            if (isStarSlot) {
              return (
                <div
                  key={slot}
                  className="flex min-h-[44px] flex-col items-center justify-center rounded-lg border-2 border-[#D97706] bg-white px-2.5 py-1.5 text-center shadow-sm"
                >
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#D97706]">
                    <Star className="h-3 w-3 fill-[#D97706]" />
                    <span>SLOT 3 (★)</span>
                  </span>
                  {chosenOpt ? (
                    <JapaneseHtmlText
                      as="span"
                      html={chosenOpt.text}
                      className="mt-0.5 text-xs font-bold text-[#0F766E]"
                    />
                  ) : (
                    <span className="mt-0.5 text-xs font-semibold text-slate-400">
                      ?
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={slot}
                className="flex min-h-[44px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/80 px-2.5 py-1.5 text-center"
              >
                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                  SLOT {slot}
                </span>
                <span className="mt-0.5 text-xs tracking-widest text-slate-400">
                  ＿＿＿
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
