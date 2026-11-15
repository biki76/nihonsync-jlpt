import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { DashboardControls } from "@/components/dashboard/DashboardControls";
import type { Exam, JlptLevel, Profile, UserAttempt } from "@/types/jlpt";

const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

const LEVEL_DESCRIPTIONS: Record<JlptLevel, string> = {
  N5: "Basic Japanese • ~100 Kanji & 800 Vocabulary",
  N4: "Elementary Japanese • ~300 Kanji & 1,500 Vocabulary",
  N3: "Intermediate Bridge • ~650 Kanji & 3,750 Vocabulary",
  N2: "Pre-Advanced Japanese • ~1,000 Kanji & 6,000 Vocabulary",
  N1: "Advanced Japanese • ~2,000+ Kanji & 10,000+ Vocabulary",
};

function formatSectionMinLabel(key: string): string {
  return key
    .split("_")
    .map((word) => (word === "and" ? "&" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileData }, { data: examsData }, { data: attemptsData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("exams")
        .select("*")
        .eq("is_published", true)
        .order("test_number", { ascending: true }),
      supabase
        .from("user_attempts")
        .select("*, exams(exam_code, level, title, max_total_score)")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

  const profile: Profile = (profileData as Profile) ?? {
    id: user.id,
    is_pro: false,
    preferred_lang: "en",
    updated_at: new Date().toISOString(),
  };

  const exams = (examsData as Exam[]) ?? [];
  const attempts = (attemptsData as UserAttempt[]) ?? [];

  const examsByLevel = JLPT_LEVELS.reduce<Record<JlptLevel, Exam[]>>(
    (acc, level) => {
      acc[level] = exams.filter((exam) => exam.level === level);
      return acc;
    },
    { N5: [], N4: [], N3: [], N2: [], N1: [] }
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E293B]">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F766E] font-jp text-lg font-bold text-white"
            >
              日
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-[#1E293B]">NihonSync</span>
                {profile.is_pro ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#D97706]">
                    <Crown className="h-3 w-3" /> NihonSync Pro
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    Free Tier
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          <DashboardControls userId={user.id} initialLang={profile.preferred_lang} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {/* Freemium Status Banner */}
        {!profile.is_pro && (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-[#FFFBEB] p-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <Crown className="h-4 w-4 text-[#D97706]" />
                <span>Free Plan Active — Mock Tests 1 &amp; 2 Unlocked Across All Levels</span>
              </div>
              <p className="mt-1 text-xs text-amber-800">
                Upgrade to NihonSync Pro to unlock Mock Tests 3–20 for N5 through N1 with full
                sectional analytics.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#D97706] px-4 py-2 text-xs font-semibold text-white">
              Tests 1–2 Ready Now
            </span>
          </div>
        )}

        {/* Recent Attempt History */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1E293B]">Recent Attempt History</h2>
            <span className="text-xs text-slate-500">{attempts.length} recorded</span>
          </div>

          {attempts.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No mock tests attempted yet. Select an exam below to start your first simulation.
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-200">
                {attempts.map((attempt) => {
                  const isCompleted = attempt.status === "completed";
                  const href = isCompleted
                    ? `/attempts/${attempt.id}/results`
                    : `/exams/${attempt.exam_id}/attempt/${attempt.id}`;

                  return (
                    <div
                      key={attempt.id}
                      className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#F0FDFA] px-2 py-0.5 text-xs font-bold text-[#0F766E]">
                            {attempt.exams?.level ?? "JLPT"}
                          </span>
                          <span className="font-semibold text-[#1E293B]">
                            {attempt.exams?.title ?? "JLPT Mock Exam"}
                          </span>
                          {isCompleted ? (
                            attempt.passed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                <XCircle className="h-3.5 w-3.5" /> FAIL
                              </span>
                            )
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              IN PROGRESS
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Started {new Date(attempt.started_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {isCompleted && attempt.total_score !== null && (
                          <div className="text-right tabular-nums">
                            <span className="text-base font-bold text-[#1E293B]">
                              {attempt.total_score}
                            </span>
                            <span className="text-xs text-slate-500">
                              {" "}
                              / {attempt.exams?.max_total_score ?? 180}
                            </span>
                          </div>
                        )}
                        <Link
                          href={href}
                          className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-[#0F766E] transition hover:border-[#0F766E] hover:bg-[#F0FDFA]"
                        >
                          {isCompleted ? "Review Answers" : "Resume Exam"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Mock Exams Grouped by JLPT Level (N5 to N1) */}
        <section className="space-y-8">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">JLPT Mock Exams (N5 – N1)</h2>
            <p className="text-xs text-slate-500">
              Passing requires meeting BOTH the overall score requirement and every sectional minimum.
            </p>
          </div>

          {JLPT_LEVELS.map((level) => {
            const levelExams = examsByLevel[level];

            return (
              <div key={level} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-[#0F766E] px-2.5 py-1 text-sm font-bold text-white">
                      JLPT {level}
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      {LEVEL_DESCRIPTIONS[level]}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {levelExams.length} {levelExams.length === 1 ? "exam" : "exams"} published
                  </span>
                </div>

                {levelExams.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-xs text-slate-500">
                    No {level} mock tests published yet. Seed an exam JSON with{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                      --publish
                    </code>{" "}
                    to display it here.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {levelExams.map((exam) => {
                      const isLocked = exam.is_premium && !profile.is_pro;

                      return (
                        <div
                          key={exam.id}
                          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {exam.exam_code}
                              </span>
                              {exam.is_premium ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#D97706]">
                                  <Lock className="h-3 w-3" /> Pro
                                </span>
                              ) : (
                                <span className="rounded-full bg-[#F0FDFA] px-2.5 py-0.5 text-xs font-semibold text-[#0F766E]">
                                  Free
                                </span>
                              )}
                            </div>

                            <h3 className="mt-2 text-base font-bold text-[#1E293B]">
                              {exam.title}
                            </h3>

                            {/* Duration & Total Pass Score */}
                            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-[#FAFAFA] p-3 text-xs tabular-nums">
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Clock className="h-3.5 w-3.5 text-[#0F766E]" />
                                <span>{exam.total_time_minutes} mins total</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Award className="h-3.5 w-3.5 text-[#0F766E]" />
                                <span>
                                  Pass: {exam.total_score_required}/{exam.max_total_score}
                                </span>
                              </div>
                            </div>

                            {/* Sectional Minimum Rules */}
                            <div className="mt-3 space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Sectional Minimums
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(exam.sectional_minimums || {}).map(
                                  ([secKey, minScore]) => (
                                    <span
                                      key={secKey}
                                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 tabular-nums"
                                    >
                                      {formatSectionMinLabel(secKey)}: &ge;{minScore}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3">
                            {isLocked ? (
                              <button
                                type="button"
                                disabled
                                className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-amber-200 bg-[#FFFBEB] px-4 py-2.5 text-xs font-semibold text-[#D97706]"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                Requires NihonSync Pro
                              </button>
                            ) : (
                              <Link
                                href={`/exams/${exam.id}`}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#115E59]"
                              >
                                <PlayCircle className="h-4 w-4" />
                                Enter Exam Briefing
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
