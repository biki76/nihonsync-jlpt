import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Database,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { AudioCheckButton } from "@/components/exam/AudioCheckButton";
import { startExamAttempt } from "@/app/actions/examActions";
import { SEED_EXAMS } from "@/data/seedExams";
import { isValidUuid } from "@/lib/validation";
import type { Exam, ExamSection } from "@/types/jlpt";

interface ExamBriefingPageProps {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ upgrade?: string }>;
}

export default async function ExamBriefingPage({
  params,
  searchParams,
}: ExamBriefingPageProps) {
  const { examId } = await params;
  const resolvedSearch = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/exams/${examId}`);
  }

  const validId = isValidUuid(examId);

  const [{ data: examData }, { data: sectionsData }, { data: profileData }] =
    validId
      ? await Promise.all([
          supabase
            .from("exams")
            .select("*")
            .eq("id", examId)
            .eq("is_published", true)
            .single(),
          supabase
            .from("exam_sections")
            .select("*")
            .eq("exam_id", examId)
            .order("section_number", { ascending: true }),
          supabase
            .from("profiles")
            .select("is_pro, pro_expires_at")
            .eq("id", user.id)
            .single(),
        ])
      : [{ data: null }, { data: null }, { data: null }];

  const exam = examData as Exam | null;

  // Graceful handling when dashboard displayed static fallback cards before DB seeding
  if (!exam) {
    const seedMatch = SEED_EXAMS.find((item) => item.id === examId);

    return (
      <div className="min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5]">
        <GlobalHeader
          userEmail={user.email}
          userId={user.id}
          backHref="/dashboard"
          backLabel="Back to Dashboard"
        />

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E04F33]/30 bg-[#FDF2EF] px-3 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
              <Database className="h-3.5 w-3.5" />
              <span>Database Seed Required</span>
            </div>

            <h1 className="mt-4 text-xl font-extrabold tracking-tight sm:text-2xl">
              {seedMatch
                ? `${seedMatch.exam_code}: ${seedMatch.title}`
                : "Exam Not Seeded in Database Yet"}
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
              Your dashboard is currently showing preview catalog cards because{" "}
              <code className="rounded bg-[#F3F1ED] px-1.5 py-0.5 text-xs dark:bg-[#27272A]">
                public.exams
              </code>{" "}
              in Supabase has no published rows yet. Run{" "}
              <code className="rounded bg-[#F3F1ED] px-1.5 py-0.5 text-xs dark:bg-[#27272A]">
                supabase/seed_n5_mock1.sql
              </code>{" "}
              in your Supabase SQL Editor to activate live exam attempts and
              server-synced timers.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#E04F33] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#C83E24]"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const sections = (sectionsData as ExamSection[]) ?? [];
  const isProActive =
    Boolean(profileData?.is_pro) &&
    (!profileData?.pro_expires_at ||
      Date.parse(profileData.pro_expires_at) > Date.now());
  const isLocked = exam.is_premium && !isProActive;

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <GlobalHeader
        userEmail={user.email}
        userId={user.id}
        backHref="/dashboard"
        backLabel="Back to Dashboard"
      />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {(isLocked || resolvedSearch.upgrade === "required") && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#E04F33]/35 bg-[#FDF2EF] p-4 text-sm text-[#18181B] dark:bg-[#E04F33]/15 dark:text-[#F4F4F5]">
            <Crown className="mt-0.5 h-5 w-5 shrink-0 text-[#E04F33]" />
            <div>
              <p className="font-bold text-[#E04F33]">
                NihonSync Pro Required
              </p>
              <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                Mock Tests 3–20 require an active NihonSync Pro subscription.
                Tests 1 and 2 are unlocked free across all levels.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-lg bg-[#E04F33] px-2.5 py-1 text-xs font-extrabold text-white">
              JLPT {exam.level}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
              {exam.exam_code}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {exam.title}
          </h1>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-4 text-xs dark:border-[#2E2E32] dark:bg-[#111113] sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#E04F33]" />
              <div>
                <p className="text-[#52525B] dark:text-[#A1A1AA]">Duration</p>
                <p className="font-bold">{exam.total_time_minutes} mins</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#E04F33]" />
              <div>
                <p className="text-[#52525B] dark:text-[#A1A1AA]">Pass Score</p>
                <p className="font-bold">
                  {exam.total_score_required} / {exam.max_total_score}
                </p>
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              <ShieldCheck className="h-4 w-4 text-[#E04F33]" />
              <div>
                <p className="text-[#52525B] dark:text-[#A1A1AA]">Grading</p>
                <p className="font-bold">Sectional Minimums</p>
              </div>
            </div>
          </div>

          {/* Section Breakdown */}
          <div className="mt-6">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
              Timed Examination Sections
            </h2>
            <div className="mt-3 space-y-2.5">
              {sections.map((sec) => (
                <div
                  key={sec.id}
                  className="flex items-center justify-between rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] px-4 py-3 text-sm dark:border-[#2E2E32] dark:bg-[#111113]"
                >
                  <div>
                    <span className="font-bold">
                      Section {sec.section_number}: {sec.section_title_en}
                    </span>
                    <span className="ml-2 font-jp text-xs text-[#52525B] dark:text-[#A1A1AA]">
                      ({sec.section_title_ja})
                    </span>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-[#E04F33]">
                    {sec.time_limit_minutes} min
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-Exam Audio Check */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-4 dark:border-[#2E2E32] dark:bg-[#111113]">
            <div>
              <p className="text-xs font-bold">
                Pre-Exam Audio Check (Listening Section)
              </p>
              <p className="text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
                Verify headphone or speaker output before starting the timer.
              </p>
            </div>
            <AudioCheckButton />
          </div>

          {/* Rules Notice */}
          <div className="mt-5 flex items-start gap-2.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E04F33]" />
            <p>
              Once started, each section countdown is anchored to the server
              clock. Refreshing the browser will not reset remaining time.
            </p>
          </div>

          <div className="mt-6">
            {isLocked ? (
              <Link
                href="/dashboard"
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#E04F33]/40 bg-[#FDF2EF] px-5 py-3 text-sm font-bold text-[#E04F33]"
              >
                <Crown className="h-4 w-4" />
                <span>Upgrade on Dashboard to Unlock</span>
              </Link>
            ) : (
              <form action={startExamAttempt.bind(null, exam.id)}>
                <button
                  type="submit"
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E24]"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span>Start Official Simulation</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
