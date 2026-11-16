"use client";

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
    <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-4 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
          Question Palette
        </h3>
        <span className="text-xs font-bold text-[#18181B] tabular-nums dark:text-[#F4F4F5]">
          {answeredCount}/{items.length}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[#18181B] dark:bg-[#F4F4F5]" />
          Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs border border-[#E04F33] bg-[#FDF2EF]" />
          Flagged ({flaggedCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs border border-[#E6E2DA] bg-[#FAF9F7] dark:border-[#2E2E32] dark:bg-[#111113]" />
          Unanswered
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-5 gap-1.5">
        {items.map((item) => {
          const isCurrent = activeQuestionId === item.questionId;

          let colorClass =
            "border-[#E6E2DA] bg-[#FAF9F7] text-[#52525B] hover:border-[#18181B] dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#A1A1AA]";
          if (item.isFlagged) {
            colorClass =
              "border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] font-bold dark:bg-[#E04F33]/15";
          } else if (item.isAnswered) {
            colorClass =
              "border-[#18181B] bg-[#18181B] text-white font-bold dark:border-[#F4F4F5] dark:bg-[#F4F4F5] dark:text-[#18181B]";
          }

          return (
            <button
              key={item.questionId}
              type="button"
              onClick={() => onSelectQuestion(item.questionId)}
              className={`relative flex h-9 items-center justify-center rounded-lg border text-xs tabular-nums transition ${colorClass} ${
                isCurrent ? "ring-2 ring-[#E04F33] ring-offset-1" : ""
              }`}
            >
              {item.questionNumber}
              {item.isFlagged && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#E04F33]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
