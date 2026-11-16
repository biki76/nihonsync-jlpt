"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Sparkles,
  Target,
} from "lucide-react";
import type { Exam } from "@/types/jlpt";

export interface ExamProgressInfo {
  percent: number; // 0 to 100 across 3 sections (0-33 Vocab, 33-66 Grammar/Read, 66-100 Listening)
  status: "not_started" | "in_progress" | "completed";
  score?: number | null;
  passed?: boolean | null;
}

interface TestCardProps {
  exam: Exam;
  isProUser: boolean;
  progress: ExamProgressInfo;
  onUnlockClick: (exam: Exam) => void;
  labels: {
    free: string;
    pro: string;
    completed: string;
    inProgress: string;
    startTest: string;
    resumeTest: string;
    reviewResult: string;
    unlockPro: string;
    progressLabel: string;
    passMark: string;
    mins: string;
  };
}

export function TestCard({
  exam,
  isProUser,
  progress,
  onUnlockClick,
  labels,
}: TestCardProps) {
  const isLocked = exam.is_premium && !isProUser;
  const displayPercent = isLocked
    ? 0
    : Math.max(0, Math.min(100, Math.round(progress.percent)));

  const sectionHint =
    displayPercent >= 100
      ? "3/3"
      : displayPercent >= 66
      ? "3/3"
      : displayPercent >= 33
      ? "2/3"
      : displayPercent > 0
      ? "1/3"
      : "0/3";

  return (
    <article
      className={`group flex flex-col justify-between rounded-[16px] border p-5 transition ${
        isLocked
          ? "border-[#E6E2DA] bg-white/80 hover:border-[#E04F33]/50 dark:border-[#2E2E32] dark:bg-[#18181B]/80"
          : "border-[#E6E2DA] bg-white shadow-xs hover:border-[#E04F33]/60 dark:border-[#2E2E32] dark:bg-[#18181B]"
      }`}
    >
      <div>
        {/* Top Row: Level + Test Number + Access/Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#18181B] px-2.5 py-1 text-xs font-bold tracking-wide text-white dark:bg-[#F4F4F5] dark:text-[#18181B]">
              {exam.level}
            </span>
            <span className="text-xs font-semibold text-[#52525B] tabular-nums dark:text-[#A1A1AA]">
              #{String(exam.test_number).padStart(2, "0")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {progress.status === "completed" && !isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF2EF] px-2.5 py-1 text-[11px] font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                <CheckCircle2 className="h-3 w-3" />
                <span>{labels.completed}</span>
              </span>
            )}

            {exam.is_premium ? (
              <button
                type="button"
                onClick={() => isLocked && onUnlockClick(exam)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  isLocked
                    ? "bg-[#E04F33] text-white shadow-xs hover:bg-[#C83E24]"
                    : "border border-[#E04F33]/30 bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                }`}
              >
                {isLocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                <span>{labels.pro}</span>
              </button>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[#E6E2DA] bg-[#F3F1ED] px-2.5 py-1 text-[11px] font-bold text-[#18181B] dark:border-[#2E2E32] dark:bg-[#27272A] dark:text-[#F4F4F5]">
                {labels.free}
              </span>
            )}
          </div>
        </div>

        {/* Title & Code */}
        <h3 className="mt-3 text-base font-bold leading-snug text-[#18181B] dark:text-[#F4F4F5]">
          {exam.title}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
          {exam.exam_code}
        </p>

        {/* Metadata Row: Duration & Pass Mark */}
        <div className="mt-3.5 flex flex-wrap items-center gap-3 text-xs text-[#52525B] dark:text-[#A1A1AA]">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3.5 w-3.5 text-[#E04F33]" />
            <span>
              {exam.total_time_minutes} {labels.mins}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Target className="h-3.5 w-3.5 text-[#E04F33]" />
            <span>
              {labels.passMark}: {exam.total_score_required}/{exam.max_total_score}
            </span>
          </span>
        </div>

        {/* 8px Pro Progress Bar with 33% & 66% Sectional Ticks */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#52525B] dark:text-[#A1A1AA]">
              {labels.progressLabel}{" "}
              <span className="text-[11px] opacity-75">({sectionHint})</span>
            </span>
            <span className="font-bold text-[#18181B] tabular-nums dark:text-[#F4F4F5]">
              {displayPercent}%
            </span>
          </div>

          <div
            className="relative h-[8px] w-full overflow-hidden rounded-full bg-[#F3F1ED] dark:bg-[#27272A]"
            role="progressbar"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${exam.title} progress ${displayPercent}%`}
          >
            {/* Solid #E04F33 Vermilion Fill */}
            <div
              className="h-full rounded-full bg-[#E04F33] transition-all duration-300"
              style={{ width: `${displayPercent}%` }}
            />

            {/* 33% Tick (End of Vocabulary) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 left-[33.333%] w-[1.5px] -translate-x-1/2 bg-white/85 dark:bg-[#18181B]/85"
            />

            {/* 66% Tick (End of Grammar & Reading) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 left-[66.666%] w-[1.5px] -translate-x-1/2 bg-white/85 dark:bg-[#18181B]/85"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-3 border-t border-[#E6E2DA] dark:border-[#2E2E32]">
        {isLocked ? (
          <button
            type="button"
            onClick={() => onUnlockClick(exam)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E04F33] bg-[#FDF2EF] px-4 py-2.5 text-sm font-bold text-[#E04F33] transition hover:bg-[#E04F33] hover:text-white dark:bg-[#E04F33]/15 dark:hover:bg-[#E04F33]"
          >
            <Lock className="h-4 w-4 shrink-0" />
            <span>{labels.unlockPro}</span>
          </button>
        ) : (
          <Link
            href={`/exams/${exam.id}`}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E24]"
          >
            <span>
              {progress.status === "completed"
                ? labels.reviewResult
                : progress.status === "in_progress"
                ? labels.resumeTest
                : labels.startTest}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </div>
    </article>
  );
}
