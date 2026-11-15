"use client";

import { Flag } from "lucide-react";

export interface PaletteItem {
  questionId: string;
  questionNumber: number;
  isAnswered: boolean;
  isFlagged: boolean;
}

interface QuestionPaletteProps {
  items: PaletteItem[];
  activeQuestionId: string | null;
  onSelectQuestion: (questionId: string) => void;
}

export function QuestionPalette({
  items,
  activeQuestionId,
  onSelectQuestion,
}: QuestionPaletteProps) {
  const answeredCount = items.filter((i) => i.isAnswered).length;
  const flaggedCount = items.filter((i) => i.isFlagged).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Question Palette
        </h3>
        <span className="text-xs font-semibold text-slate-600 tabular-nums">
          {answeredCount}/{items.length} Answered
        </span>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 border-b border-slate-100 pb-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0F766E]" />
          Answered ({answeredCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-amber-400 bg-[#FFFBEB]" />
          Flagged ({flaggedCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" />
          Unanswered
        </span>
      </div>

      {/* Number Grid */}
      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
        {items.map((item) => {
          const isActive = activeQuestionId === item.questionId;

          let btnClass =
            "border-slate-300 bg-white text-[#1E293B] hover:border-[#0F766E]";
          if (item.isFlagged) {
            btnClass =
              "border-amber-400 bg-[#FFFBEB] text-amber-900 font-bold";
          } else if (item.isAnswered) {
            btnClass =
              "border-[#0F766E] bg-[#0F766E] text-white font-semibold";
          }

          return (
            <button
              key={item.questionId}
              type="button"
              onClick={() => onSelectQuestion(item.questionId)}
              className={`relative flex h-9 items-center justify-center rounded-lg border text-xs tabular-nums transition ${btnClass} ${
                isActive ? "ring-2 ring-[#0F766E]/40 ring-offset-1" : ""
              }`}
            >
              <span>{item.questionNumber}</span>
              {item.isFlagged && (
                <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-[#D97706] text-[#D97706]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
