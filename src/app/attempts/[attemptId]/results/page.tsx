import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  Target,
  XCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { gradeAndCompleteAttempt } from "@/app/actions/gradeAttempt";
import {
  AnswerReviewList,
  type ReviewQuestionItem,
} from "@/components/results/AnswerReviewList";
import type {
  Exam,
  ExamSection,
  MondaiGroup,
  QuestionOption,
  SupportedLang,
  UserAttempt,
} from "@/types/jlpt";

interface ResultsPageProps {
  params: Promise<{ attemptId: string }>;
}

interface RpcReviewRow {
  question_id: string;
  mondai_group_id: string;
  question_number: number;
  prompt_html: string;
  options: QuestionOption[];
  correct_option: number;
  correct_sequence: number[] | null;
  points: number;
  audio_url: string | null;
  image_url: string | null;
  transcript_ja: string | null;
  explanation: Record<string, string> | null;
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const diffSec = Math.max(
    0,
    Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000)
  );
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/attempts/${attemptId}/results`);
  }

  const { data: attemptData } = await supabase
    .from("user_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attemptData) {
    notFound();
  }

  let attempt = attemptData as UserAttempt;

  const [{ data: examData }, { data: sectionsData }, { data: profileData }] =
    await Promise.all([
      supabase.from("exams").select("*").eq("id", attempt.exam_id).single(),
      supabase
        .from("exam_sections")
        .select("*")
        .eq("exam_id", attempt.exam_id)
        .order("section_number", { ascending: true }),
      supabase
        .from("profiles")
        .select("preferred_lang")
        .eq("id", user.id)
        .single(),
    ]);

  if (!examData) {
    notFound();
  }

  const exam = examData as Exam;
  const sections = (sectionsData as ExamSection[]) ?? [];
  const preferredLang = (profileData?.preferred_lang as SupportedLang) || "en";

  if (attempt.status !== "completed") {
    const totalSections = sections.length || 3;
    if (attempt.current_section < totalSections) {
      redirect(`/exams/${exam.id}/attempt/${attempt.id}`);
    }
    await gradeAndCompleteAttempt(attempt.id);

    const { data: refreshed } = await supabase
      .from("user_attempts")
      .select("*")
      .eq("id", attempt.id)
      .eq("user_id", user.id)
      .single();

    if (refreshed) {
      attempt = refreshed as UserAttempt;
    }
  } else if (
    attempt.total_score === null ||
    attempt.passed === null ||
    attempt.section_scores === null
  ) {
    await gradeAndCompleteAttempt(attempt.id);
    const { data: refreshed } = await supabase
      .from("user_attempts")
      .select("*")
      .eq("id", attempt.id)
      .eq("user_id", user.id)
      .single();
    if (refreshed) {
      attempt = refreshed as UserAttempt;
    }
  }

  const sectionIds = sections.map((s) => s.id);

  const [{ data: rpcQuestions }, { data: mondaiData }, { data: answersData }] =
    await Promise.all([
      supabase.rpc("get_attempt_review_questions", {
        p_attempt_id: attempt.id,
      }),
      sectionIds.length > 0
        ? supabase
            .from("mondai_groups")
            .select("*")
            .in("section_id", sectionIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("user_answers")
        .select("question_id, selected_option, is_flagged, is_correct")
        .eq("attempt_id", attempt.id),
    ]);

  const sectionMap = new Map<string, ExamSection>();
  for (const s of sections) {
    sectionMap.set(s.id, s);
  }

  const mondaiMap = new Map<string, MondaiGroup>();
  for (const m of (mondaiData as MondaiGroup[]) ?? []) {
    mondaiMap.set(m.id, m);
  }

  const answerMap = new Map<
    string,
    {
      selected_option: number | null;
      is_flagged: boolean;
      is_correct: boolean | null;
    }
  >();
  for (const a of answersData ?? []) {
    answerMap.set(a.question_id, a);
  }

  const reviewItems: ReviewQuestionItem[] = (
    (rpcQuestions as RpcReviewRow[]) ?? []
  ).map((q) => {
    const mg = mondaiMap.get(q.mondai_group_id);
    const sec = mg ? sectionMap.get(mg.section_id) : undefined;
    const ans = answerMap.get(q.question_id);
    const isCorrect =
      ans?.is_correct !== null && ans?.is_correct !== undefined
        ? Boolean(ans.is_correct)
        : ans?.selected_option === q.correct_option;

    return {
      question_id: q.question_id,
      section_number: sec?.section_number ?? 1,
      section_title_ja: sec?.section_title_ja ?? "",
      section_title_en: sec?.section_title_en ?? "",
      mondai_number: mg?.mondai_number ?? 1,
      question_type: mg?.question_type ?? "multiple_choice",
      instruction_ja: mg?.instruction_ja ?? "",
      passage_html: mg?.passage_html ?? null,
      question_number: q.question_number,
      prompt_html: q.prompt_html,
      options: q.options ?? [],
      correct_option: q.correct_option,
      correct_sequence: q.correct_sequence ?? null,
      points: q.points,
      audio_url: q.audio_url,
      image_url: q.image_url,
      transcript_ja: q.transcript_ja,
      explanation: q.explanation,
      selected_option: ans?.selected_option ?? null,
      is_flagged: Boolean(ans?.is_flagged),
      is_correct: isCorrect,
    };
  });

  const totalQuestions = reviewItems.length;
  const correctQuestions = reviewItems.filter((r) => r.is_correct).length;
  const accuracyPct =
    totalQuestions > 0
      ? Math.round((correctQuestions / totalQuestions) * 100)
      : 0;

  const scores = attempt.section_scores ?? {};
  const totalScore = attempt.total_score ?? 0;
  const maxTotalScore = exam.max_total_score || 180;
  const requiredTotal = exam.total_score_required;

  const combinedLangReadScore =
    scores.language_knowledge_and_reading ??
    (scores.VOCAB ?? 0) + (scores.GRAMMAR_READING ?? 0);
  const listeningScore = scores.listening ?? scores.LISTENING ?? 0;

  const minimums = exam.sectional_minimums ?? {};
  const minLangRead = minimums.language_knowledge_and_reading ?? 38;
  const minListening = minimums.listening ?? 19;

  const isSeparatedThreeScore =
    typeof minimums.language_knowledge === "number" &&
    typeof minimums.reading === "number";

  const maxLangRead = isSeparatedThreeScore ? 60 : 120;
  const maxListening = 60;

  const passed = Boolean(attempt.passed);

  const failReasons: string[] = [];
  if (!passed) {
    if (totalScore < requiredTotal) {
      failReasons.push(
        `Total score (${totalScore}) was below the required ${requiredTotal} pts`
      );
    }
    if (isSeparatedThreeScore) {
      const lk = scores.language_knowledge ?? scores.VOCAB ?? 0;
      const rd = scores.reading ?? scores.GRAMMAR_READING ?? 0;
      if (lk < (minimums.language_knowledge ?? 19)) {
        failReasons.push(
          `Language Knowledge (${lk}) was below the ${minimums.language_knowledge ?? 19} pt sectional minimum`
        );
      }
      if (rd < (minimums.reading ?? 19)) {
        failReasons.push(
          `Reading (${rd}) was below the ${minimums.reading ?? 19} pt sectional minimum`
        );
      }
    } else if (combinedLangReadScore < minLangRead) {
      failReasons.push(
        `Language Knowledge & Reading (${combinedLangReadScore}) was below the ${minLangRead} pt sectional minimum`
      );
    }
    if (listeningScore < minListening) {
      failReasons.push(
        `Listening (${listeningScore}) was below the ${minListening} pt sectional minimum`
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <header className="border-b border-[#E6E2DA] bg-white dark:border-[#2E2E32] dark:bg-[#18181B]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#52525B] transition hover:text-[#E04F33] dark:text-[#A1A1AA]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Catalog
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
            {exam.exam_code} • Official Scorecard
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* Pass / Fail Banner with Circular 56px x 56px -8deg Hanko Stamp */}
        <div
          className={`rounded-[16px] border p-6 shadow-xs ${
            passed
              ? "border-emerald-300 bg-emerald-50/75 dark:border-emerald-900 dark:bg-emerald-950/25"
              : "border-[#E04F33]/45 bg-[#FDF2EF] dark:bg-[#E04F33]/12"
          }`}
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              {/* Circular Double-Ring 56px x 56px -8deg Hanko Stamp */}
              <div
                aria-label={passed ? "Passed Stamp" : "Not Passed Stamp"}
                style={{ transform: "rotate(-8deg)" }}
                className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border-[2.5px] border-[#E04F33] bg-white/90 p-0.5 shadow-xs dark:bg-[#18181B]/90"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full border border-[#E04F33] font-jp text-xs font-extrabold tracking-tighter text-[#E04F33]">
                  {passed ? "合格" : "不合格"}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#18181B] px-2 py-0.5 text-xs font-bold text-white dark:bg-[#F4F4F5] dark:text-[#18181B]">
                    JLPT {exam.level}
                  </span>
                  <span className="text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
                    {exam.title}
                  </span>
                </div>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                  {passed ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <span>PASSED (合格)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-[#E04F33]" />
                      <span>NOT PASSED (不合格)</span>
                    </>
                  )}
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                  {passed
                    ? "Congratulations! You met both the overall JLPT pass mark and every sectional minimum threshold."
                    : failReasons.length > 0
                    ? `Reason: ${failReasons.join("; ")}.`
                    : "Did not meet all JLPT passing criteria."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/exams/${exam.id}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-white px-4 py-2 text-xs font-bold text-[#18181B] shadow-xs transition hover:border-[#E04F33] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#E04F33]" />
                Retake Exam
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#E04F33] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#C83E24]"
              >
                Back to Catalog
              </Link>
            </div>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-3 tabular-nums">
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-4 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <span className="text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
              Total Scaled Score
            </span>
            <p className="mt-1 text-2xl font-extrabold text-[#18181B] dark:text-[#F4F4F5]">
              {totalScore}{" "}
              <span className="text-sm font-medium text-[#52525B] dark:text-[#A1A1AA]">
                / {maxTotalScore}
              </span>
            </p>
          </div>

          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-4 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
              <Target className="h-3.5 w-3.5 text-[#E04F33]" />
              <span>Question Accuracy</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#18181B] dark:text-[#F4F4F5]">
              {accuracyPct}%{" "}
              <span className="text-sm font-medium text-[#52525B] dark:text-[#A1A1AA]">
                ({correctQuestions}/{totalQuestions})
              </span>
            </p>
          </div>

          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-4 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
              <Clock className="h-3.5 w-3.5 text-[#E04F33]" />
              <span>Completion Time</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-[#18181B] dark:text-[#F4F4F5]">
              {formatDuration(attempt.started_at, attempt.completed_at)}
            </p>
          </div>
        </div>

        {/* Sectional Score Progress Bars with Pass Threshold Markers */}
        <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
          <h2 className="text-base font-bold">
            Sectional Breakdown &amp; Pass Thresholds
          </h2>
          <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
            The vertical marker on each bar indicates the official JLPT minimum required score.
          </p>

          <div className="mt-5 space-y-6 tabular-nums">
            <ScoreBar
              label="Total Score"
              score={totalScore}
              maxScore={maxTotalScore}
              minRequired={requiredTotal}
            />

            {isSeparatedThreeScore ? (
              <>
                <ScoreBar
                  label="Language Knowledge (Vocabulary & Grammar)"
                  score={scores.language_knowledge ?? scores.VOCAB ?? 0}
                  maxScore={60}
                  minRequired={minimums.language_knowledge ?? 19}
                />
                <ScoreBar
                  label="Reading Comprehension"
                  score={scores.reading ?? scores.GRAMMAR_READING ?? 0}
                  maxScore={60}
                  minRequired={minimums.reading ?? 19}
                />
              </>
            ) : (
              <ScoreBar
                label="Language Knowledge & Reading (Vocab + Grammar/Reading)"
                score={combinedLangReadScore}
                maxScore={maxLangRead}
                minRequired={minLangRead}
              />
            )}

            <ScoreBar
              label="Listening Comprehension"
              score={listeningScore}
              maxScore={maxListening}
              minRequired={minListening}
            />
          </div>
        </div>

        {/* Interactive 8-Language Answer Review Panel */}
        <div>
          <h2 className="mb-3 text-lg font-bold">
            Detailed Answer Review &amp; Explanations
          </h2>
          <AnswerReviewList items={reviewItems} initialLang={preferredLang} />
        </div>
      </main>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  maxScore,
  minRequired,
}: {
  label: string;
  score: number;
  maxScore: number;
  minRequired: number;
}) {
  const metThreshold = score >= minRequired;
  const fillPct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const thresholdPct = Math.min(
    100,
    Math.max(0, (minRequired / maxScore) * 100)
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-[#18181B] dark:text-[#F4F4F5]">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[#52525B] dark:text-[#A1A1AA]">
            Min Pass:{" "}
            <strong className="text-[#18181B] dark:text-[#F4F4F5]">
              {minRequired} pts
            </strong>
          </span>
          <span
            className={`font-extrabold ${
              metThreshold ? "text-emerald-600" : "text-[#E04F33]"
            }`}
          >
            {score} / {maxScore}
          </span>
        </div>
      </div>

      <div className="relative mt-2 h-3 w-full rounded-full bg-[#F3F1ED] dark:bg-[#27272A]">
        <div
          className={`h-full rounded-full transition-all ${
            metThreshold ? "bg-emerald-600" : "bg-[#E04F33]"
          }`}
          style={{ width: `${fillPct}%` }}
        />

        <div
          className="absolute -top-1.5 bottom-0 h-6 w-0.5 bg-[#18181B] dark:bg-[#F4F4F5]"
          style={{ left: `${thresholdPct}%` }}
          title={`Minimum Pass Threshold: ${minRequired} pts`}
        />
      </div>
    </div>
  );
}
