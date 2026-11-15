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
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E293B]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition hover:text-[#1E293B]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {exam.exam_code}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Exam Header Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#0F766E] px-2.5 py-0.5 text-xs font-bold text-white">
              JLPT {exam.level}
            </span>
            {exam.is_premium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#D97706]">
                <Crown className="h-3 w-3" /> NihonSync Pro
              </span>
            ) : (
              <span className="rounded-full bg-[#F0FDFA] px-2.5 py-0.5 text-xs font-semibold text-[#0F766E]">
                Free Mock Test
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold text-[#1E293B] sm:text-3xl">
            {exam.title}
          </h1>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 tabular-nums">
            <div className="rounded-lg border border-slate-200 bg-[#FAFAFA] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Total Duration</span>
              </div>
              <p className="mt-1 text-lg font-bold text-[#1E293B]">
                {exam.total_time_minutes} mins
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#FAFAFA] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Award className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Overall Pass Mark</span>
              </div>
              <p className="mt-1 text-lg font-bold text-[#1E293B]">
                {exam.total_score_required} / {exam.max_total_score} pts
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#FAFAFA] p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldAlert className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Sectional Minimums</span>
              </div>
              <div className="mt-1 space-y-0.5 text-xs font-semibold text-[#1E293B]">
                {Object.entries(exam.sectional_minimums || {}).map(([k, v]) => (
                  <div key={k}>
                    {formatMinLabel(k)}: &ge;{v} pts
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#1E293B]">
            Exam Structure &amp; Timed Sections
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Sections are taken sequentially. Once you submit a section or its timer reaches 00:00,
            you cannot return to earlier sections.
          </p>

          <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {sections.map((sec) => (
              <div
                key={sec.id}
                className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                      Section {sec.section_number}
                    </span>
                    <span className="font-jp text-sm font-bold text-[#1E293B]">
                      {sec.section_title_ja}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {sec.section_title_en} ({sec.section_code})
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] tabular-nums">
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

        {/* Freemium Lock Card vs. Start Exam Action */}
        {isLocked ? (
          <div className="rounded-xl border border-amber-300 bg-[#FFFBEB] p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D97706] text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-amber-950">
                  NihonSync Pro Upgrade Required
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                  Mock Tests 1 and 2 are free for all learners. Mock Test {exam.test_number} (
                  {exam.exam_code}) is part of the NihonSync Pro library (Tests 3–20 across N5–N1).
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-[#D97706] px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                  >
                    Return to Free Exams
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
              <p>
                Your countdown timer starts immediately on the server when you enter Section 1 and
                continues running even if you refresh or close your browser.
              </p>
            </div>

            <form action={startAction} className="mt-5">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115E59] sm:w-auto"
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
