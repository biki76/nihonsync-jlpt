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
        className="text-base font-medium text-[#18181B] dark:text-[#F4F4F5] sm:text-lg"
      />

      <div className="rounded-xl border border-[#E04F33]/35 bg-[#FDF2EF] p-3.5 dark:bg-[#E04F33]/12">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#E04F33]">
          <Star className="h-3.5 w-3.5 fill-[#E04F33]" />
          <span>Word Order Assembly — Select Option for Slot 3 (★)</span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((slot) => {
            const isStarSlot = slot === 3;

            if (isStarSlot) {
              return (
                <div
                  key={slot}
                  className="flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 border-[#E04F33] bg-white px-2.5 py-1.5 text-center shadow-xs dark:bg-[#18181B]"
                >
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#E04F33]">
                    <Star className="h-3 w-3 fill-[#E04F33]" />
                    <span>SLOT 3 (★)</span>
                  </span>
                  {chosenOpt ? (
                    <JapaneseHtmlText
                      as="span"
                      html={chosenOpt.text}
                      className="mt-0.5 text-xs font-bold text-[#E04F33]"
                    />
                  ) : (
                    <span className="mt-0.5 text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
                      ?
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={slot}
                className="flex min-h-[48px] flex-col items-center justify-center rounded-xl border border-dashed border-[#E6E2DA] bg-white/85 px-2.5 py-1.5 text-center dark:border-[#2E2E32] dark:bg-[#18181B]/85"
              >
                <span className="text-[10px] font-semibold text-[#52525B] tabular-nums dark:text-[#A1A1AA]">
                  SLOT {slot}
                </span>
                <span className="mt-0.5 text-xs tracking-widest text-[#52525B] dark:text-[#A1A1AA]">
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
