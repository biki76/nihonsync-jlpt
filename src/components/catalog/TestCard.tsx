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
import type { Exam, SupportedLang, UserAttempt } from "@/types/jlpt";

interface TestCardProps {
  exam: Exam;
  isLocked: boolean;
  progressPct: number;
  attempt?: UserAttempt;
  lang: SupportedLang;
  onLockedClick: (exam: Exam) => void;
}

const UI = {
  en: {
    free: "Free",
    pro: "Pro",
    completed: "Completed",
    startTest: "Start Mock Test",
    resumeTest: "Resume Section",
    reviewResult: "Retake / Review",
    unlockPro: "Unlock with Pro",
    progressLabel: "Section Progress",
    passMark: "Pass",
    mins: "mins",
  },
  bn: {
    free: "ফ্রি",
    pro: "প্রো",
    completed: "সম্পন্ন",
    startTest: "মক টেস্ট শুরু করুন",
    resumeTest: "চালিয়ে যান",
    reviewResult: "ফলাফল ও রিভিউ",
    unlockPro: "প্রো দিয়ে আনলক করুন",
    progressLabel: "সেকশন অগ্রগতি",
    passMark: "পাস নম্বর",
    mins: "মিনিট",
  },
  hi: {
    free: "निःशुल्क",
    pro: "Pro",
    completed: "पूर्ण",
    startTest: "मॉक टेस्ट शुरू करें",
    resumeTest: "जारी रखें",
    reviewResult: "समीक्षा देखें",
    unlockPro: "Pro से अनलॉक करें",
    progressLabel: "अनुभाग प्रगति",
    passMark: "उत्तीर्ण अंक",
    mins: "मिनट",
  },
  id: {
    free: "Gratis",
    pro: "Pro",
    completed: "Selesai",
    startTest: "Mulai Ujian Simulasi",
    resumeTest: "Lanjutkan Bagian",
    reviewResult: "Ulangi / Tinjau",
    unlockPro: "Buka dengan Pro",
    progressLabel: "Progres Bagian",
    passMark: "Lulus",
    mins: "menit",
  },
  th: {
    free: "ฟรี",
    pro: "Pro",
    completed: "เสร็จสิ้น",
    startTest: "เริ่มทำข้อสอบจำลอง",
    resumeTest: "ทำข้อสอบต่อ",
    reviewResult: "ดูเฉลย / ทำซ้ำ",
    unlockPro: "ปลดล็อกด้วย Pro",
    progressLabel: "ความคืบหน้าแต่ละพาร์ท",
    passMark: "เกณฑ์ผ่าน",
    mins: "นาที",
  },
  vi: {
    free: "Miễn phí",
    pro: "Pro",
    completed: "Hoàn thành",
    startTest: "Bắt đầu thi thử",
    resumeTest: "Tiếp tục làm bài",
    reviewResult: "Xem lại / Thi lại",
    unlockPro: "Mở khóa với Pro",
    progressLabel: "Tiến độ phần thi",
    passMark: "Điểm đỗ",
    mins: "phút",
  },
  zh: {
    free: "免费",
    pro: "Pro",
    completed: "已完成",
    startTest: "开始模拟考试",
    resumeTest: "继续答题",
    reviewResult: "查看解析 / 重测",
    unlockPro: "Pro 专享解锁",
    progressLabel: "科目进度",
    passMark: "合格线",
    mins: "分钟",
  },
  ko: {
    free: "무료",
    pro: "Pro",
    completed: "완료",
    startTest: "모의고사 시작",
    resumeTest: "이어서 풀기",
    reviewResult: "결과 및 해설 보기",
    unlockPro: "Pro로 잠금 해제",
    progressLabel: "영역별 진행률",
    passMark: "합격 기준",
    mins: "분",
  },
};

export function TestCard({
  exam,
  isLocked,
  progressPct,
  attempt,
  lang,
  onLockedClick,
}: TestCardProps) {
  const t = UI[lang] ?? UI.en;
  const displayPercent = isLocked ? 0 : Math.max(0, Math.min(100, Math.round(progressPct)));

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
          ? "border-[#E5E2DC] bg-white/80 hover:border-[#E04F33]/50 dark:border-[#27272A] dark:bg-[#18181B]/80"
          : "border-[#E5E2DC] bg-white shadow-xs hover:border-[#E04F33]/60 dark:border-[#27272A] dark:bg-[#18181B]"
      }`}
    >
      <div>
        {/* Top Row: Level + Test Number + Access/Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0F172A] px-2.5 py-1 text-xs font-bold tracking-wide text-white dark:bg-[#F4F4F5] dark:text-[#0F172A]">
              {exam.level}
            </span>
            <span className="text-xs font-semibold text-[#475569] tabular-nums dark:text-[#A1A1AA]">
              #{String(exam.test_number).padStart(2, "0")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {attempt?.status === "completed" && !isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF2EF] px-2.5 py-1 text-[11px] font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                <CheckCircle2 className="h-3 w-3" />
                <span>{t.completed}</span>
              </span>
            )}

            {exam.is_premium ? (
              <button
                type="button"
                onClick={() => isLocked && onLockedClick(exam)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  isLocked
                    ? "bg-[#E04F33] text-white shadow-xs hover:bg-[#C83E23]"
                    : "border border-[#E04F33]/30 bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                }`}
              >
                {isLocked ? <Lock className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                <span>{t.pro}</span>
              </button>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[#E5E2DC] bg-[#F3F2EE] px-2.5 py-1 text-[11px] font-bold text-[#0F172A] dark:border-[#27272A] dark:bg-[#222226] dark:text-[#F4F4F5]">
                {t.free}
              </span>
            )}
          </div>
        </div>

        {/* Title & Code */}
        <h3 className="mt-3 text-base font-bold leading-snug text-[#0F172A] dark:text-[#F4F4F5]">
          {exam.title}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-[#475569] dark:text-[#A1A1AA]">
          {exam.exam_code}
        </p>

        {/* Metadata Row: Duration & Pass Mark */}
        <div className="mt-3.5 flex flex-wrap items-center gap-3 text-xs text-[#475569] dark:text-[#A1A1AA]">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3.5 w-3.5 text-[#E04F33]" />
            <span>
              {exam.total_time_minutes} {t.mins}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Target className="h-3.5 w-3.5 text-[#E04F33]" />
            <span>
              {t.passMark}: {exam.total_score_required}/{exam.max_total_score}
            </span>
          </span>
        </div>

        {/* 8px Pro Progress Bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#475569] dark:text-[#A1A1AA]">
              {t.progressLabel}{" "}
              <span className="text-[11px] opacity-75">({sectionHint})</span>
            </span>
            <span className="font-bold text-[#0F172A] tabular-nums dark:text-[#F4F4F5]">
              {displayPercent}%
            </span>
          </div>

          <div
            className="relative h-[8px] w-full overflow-hidden rounded-full bg-[#F3F2EE] dark:bg-[#27272A]"
            role="progressbar"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[#E04F33] transition-all duration-300"
              style={{ width: `${displayPercent}%` }}
            />
            <span className="pointer-events-none absolute top-0 bottom-0 left-[33.333%] w-[1.5px] -translate-x-1/2 bg-white/85 dark:bg-[#18181B]/85" />
            <span className="pointer-events-none absolute top-0 bottom-0 left-[66.666%] w-[1.5px] -translate-x-1/2 bg-white/85 dark:bg-[#18181B]/85" />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 border-t border-[#E5E2DC] pt-3 dark:border-[#27272A]">
        {isLocked ? (
          <button
            type="button"
            onClick={() => onLockedClick(exam)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E04F33] bg-[#FDF2EF] px-4 py-2.5 text-sm font-bold text-[#E04F33] transition hover:bg-[#E04F33] hover:text-white dark:bg-[#E04F33]/15 dark:hover:bg-[#E04F33]"
          >
            <Lock className="h-4 w-4 shrink-0" />
            <span>{t.unlockPro}</span>
          </button>
        ) : (
          <Link
            href={`/exams/${exam.id}`}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E23]"
          >
            <span>
              {attempt?.status === "completed"
                ? t.reviewResult
                : attempt?.status === "in_progress"
                ? t.resumeTest
                : t.startTest}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}
      </div>
    </article>
  );
}
