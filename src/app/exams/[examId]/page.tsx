import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Clock,
  Crown,
  Lock,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { startExamAttempt } from "@/app/actions/examActions";
import { AudioCheckButton } from "@/components/exam/AudioCheckButton";
import type { Exam, ExamSection } from "@/types/jlpt";

interface ExamBriefingPageProps {
  params: Promise<{ examId: string }>;
}

function formatMinLabel(key: string): string {
  return key
    .split("_")
    .map((w) => (w === "and" ? "&" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export default async function ExamBriefingPage({ params }: ExamBriefingPageProps) {
  const { examId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/exams/${examId}`);
  }

  const [{ data: examData }, { data: sectionsData }, { data: profile }, { data: activeAttempt }] =
    await Promise.all([
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
        .select("is_pro")
        .eq("id", user.id)
        .single(),
      supabase
        .from("user_attempts")
        .select("id, current_section")
        .eq("user_id", user.id)
        .eq("exam_id", examId)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!examData) {
    notFound();
  }

  const exam = examData as Exam;
  const sections = (sectionsData as ExamSection[]) ?? [];
  const isPro = Boolean(profile?.is_pro);
  const isLocked = exam.is_premium && !isPro;

  const startAction = startExamAttempt.bind(null, exam.id);

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <header className="border-b border-[#E6E2DA] bg-white dark:border-[#2E2E32] dark:bg-[#18181B]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#52525B] transition hover:text-[#E04F33] dark:text-[#A1A1AA]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Catalog
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
            {exam.exam_code}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#18181B] px-2.5 py-1 text-xs font-bold text-white dark:bg-[#F4F4F5] dark:text-[#18181B]">
              JLPT {exam.level}
            </span>
            {exam.is_premium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF2EF] px-2.5 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                <Crown className="h-3 w-3" /> NihonSync Pro
              </span>
            ) : (
              <span className="rounded-full border border-[#E6E2DA] bg-[#F3F1ED] px-2.5 py-1 text-xs font-bold text-[#18181B] dark:border-[#2E2E32] dark:bg-[#27272A] dark:text-[#F4F4F5]">
                Free Mock Test
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold text-[#18181B] dark:text-[#F4F4F5] sm:text-3xl">
            {exam.title}
          </h1>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 tabular-nums">
            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-3.5 dark:border-[#2E2E32] dark:bg-[#111113]">
              <div className="flex items-center gap-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                <Clock className="h-3.5 w-3.5 text-[#E04F33]" />
                <span>Total Duration</span>
              </div>
              <p className="mt-1 text-lg font-bold">
                {exam.total_time_minutes} mins
              </p>
            </div>

            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-3.5 dark:border-[#2E2E32] dark:bg-[#111113]">
              <div className="flex items-center gap-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                <Award className="h-3.5 w-3.5 text-[#E04F33]" />
                <span>Overall Pass Mark</span>
              </div>
              <p className="mt-1 text-lg font-bold">
                {exam.total_score_required} / {exam.max_total_score} pts
              </p>
            </div>

            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-3.5 dark:border-[#2E2E32] dark:bg-[#111113]">
              <div className="flex items-center gap-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                <ShieldAlert className="h-3.5 w-3.5 text-[#E04F33]" />
                <span>Sectional Minimums</span>
              </div>
              <div className="mt-1 space-y-0.5 text-xs font-semibold">
                {Object.entries(exam.sectional_minimums || {}).map(([k, v]) => (
                  <div key={k}>
                    {formatMinLabel(k)}: &ge;{v} pts
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
          <h2 className="text-base font-bold">
            Exam Structure &amp; Timed Sections
          </h2>
          <p className="mt-1 text-xs text-[#52525B] dark:text-[#A1A1AA]">
            Sections are taken sequentially. Once you submit a section or its timer reaches 00:00,
            you cannot return to earlier sections.
          </p>

          <div className="mt-4 divide-y divide-[#E6E2DA] rounded-xl border border-[#E6E2DA] dark:divide-[#2E2E32] dark:border-[#2E2E32]">
            {sections.map((sec) => (
              <div
                key={sec.id}
                className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#F3F1ED] px-2 py-0.5 text-xs font-bold text-[#18181B] dark:bg-[#27272A] dark:text-[#F4F4F5]">
                      Section {sec.section_number}
                    </span>
                    <span className="font-jp text-sm font-bold">
                      {sec.section_title_ja}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    {sec.section_title_en} ({sec.section_code})
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E04F33] tabular-nums">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{sec.time_limit_minutes} minutes</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <AudioCheckButton />
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-[16px] border border-[#E04F33]/40 bg-[#FDF2EF] p-6 shadow-xs dark:bg-[#E04F33]/12">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E04F33] text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#18181B] dark:text-[#F4F4F5]">
                  NihonSync Pro Upgrade Required
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                  Mock Tests 1 and 2 are free for all learners. Mock Test {exam.test_number} (
                  {exam.exam_code}) is part of the NihonSync Pro library (Tests 3–20 across N5–N1).
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-[#E04F33] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C83E24]"
                  >
                    Return to Mock Test Catalog
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <div className="flex items-start gap-2.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#E04F33]" />
              <p>
                Your countdown timer starts immediately on the server when you enter Section 1 and
                continues running even if you refresh or close your browser.
              </p>
            </div>

            <form action={startAction} className="mt-5">
              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-6 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E24] sm:w-auto"
              >
                <PlayCircle className="h-4 w-4" />
                <span>
                  {activeAttempt
                    ? `Resume Exam (Section ${activeAttempt.current_section})`
                    : "Start Timed Exam Now"}
                </span>
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
