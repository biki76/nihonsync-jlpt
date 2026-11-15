import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
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
  UserAnswer,
  UserAttempt,
} from "@/types/jlpt";

interface ResultsPageProps {
  params: Promise<{ attemptId: string }>;
}

interface ReviewRpcRow {
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
  explanation: Record<string, string>;
}

function formatDurationMinutes(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const diffMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
  const totalMins = Math.max(1, Math.round(diffMs / 60000));
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins}m`;
}

export default async function AttemptResultsPage({ params }: ResultsPageProps) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/attempts/${attemptId}/results`);
  }

  const { data: initialAttemptData } = await supabase
    .from("user_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!initialAttemptData) {
    notFound();
  }

  let attempt = initialAttemptData as UserAttempt;

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

  // Auto-grade if user reached the final section, else redirect back to active exam
  if (attempt.status !== "completed") {
    const totalSections = sections.length || 3;
    if (attempt.current_section >= totalSections) {
      await gradeAndCompleteAttempt(attempt.id);
      const { data: refreshedAttempt } = await supabase
        .from("user_attempts")
        .select("*")
        .eq("id", attempt.id)
        .eq("user_id", user.id)
        .single();
      if (refreshedAttempt) {
        attempt = refreshedAttempt as UserAttempt;
      }
    } else {
      redirect(`/exams/${attempt.exam_id}/attempt/${attempt.id}`);
    }
  }

  const sectionIds = sections.map((s) => s.id);
  const [{ data: mondaiData }, { data: answersData }, { data: reviewRowsData, error: rpcErr }] =
    await Promise.all([
      supabase
        .from("mondai_groups")
        .select("*")
        .in("section_id", sectionIds),
      supabase
        .from("user_answers")
        .select("*")
        .eq("attempt_id", attempt.id),
      supabase.rpc("get_attempt_review_questions", {
        p_attempt_id: attempt.id,
      }),
    ]);

  if (rpcErr) {
    throw new Error(`Failed to load review questions: ${rpcErr.message}`);
  }

  const mondaiGroups = (mondaiData as MondaiGroup[]) ?? [];
  const userAnswers = (answersData as UserAnswer[]) ?? [];
  const reviewRows = (reviewRowsData as ReviewRpcRow[]) ?? [];

  const sectionById = new Map<string, ExamSection>();
  for (const s of sections) sectionById.set(s.id, s);

  const mondaiById = new Map<string, MondaiGroup>();
  for (const m of mondaiGroups) mondaiById.set(m.id, m);

  const answerByQuestionId = new Map<string, UserAnswer>();
  for (const a of userAnswers) answerByQuestionId.set(a.question_id, a);

  const reviewQuestions: ReviewQuestionItem[] = reviewRows.map((row) => {
    const mg = mondaiById.get(row.mondai_group_id);
    const sec = mg ? sectionById.get(mg.section_id) : undefined;
    const ans = answerByQuestionId.get(row.question_id);
    const selectedOption = ans?.selected_option ?? null;
    const isCorrect =
      ans?.is_correct ??
      (selectedOption !== null && selectedOption === row.correct_option);

    return {
      question_id: row.question_id,
      section_number: sec?.section_number ?? 1,
      section_code: sec?.section_code ?? "SECTION",
      section_title_ja: sec?.section_title_ja ?? "",
      section_title_en: sec?.section_title_en ?? "",
      mondai_number: mg?.mondai_number ?? 1,
      question_type: mg?.question_type ?? "standard",
      instruction_ja: mg?.instruction_ja ?? "",
      passage_html: mg?.passage_html ?? null,
      question_number: row.question_number,
      prompt_html: row.prompt_html,
      options: row.options,
      correct_option: row.correct_option,
      correct_sequence: row.correct_sequence,
      points: row.points,
      audio_url: row.audio_url,
      image_url: row.image_url,
      transcript_ja: row.transcript_ja,
      explanation: row.explanation || {},
      selected_option: selectedOption,
      is_flagged: Boolean(ans?.is_flagged),
      is_correct: Boolean(isCorrect),
    };
  });

  // Scorecard Metrics
  const totalScore = attempt.total_score ?? 0;
  const maxTotalScore = exam.max_total_score || 180;
  const totalRequired = exam.total_score_required || 80;
  const passed = Boolean(attempt.passed);

  const sectionScores = attempt.section_scores || {};
  const vocabScore = sectionScores["VOCAB"] ?? 0;
  const grammarReadingScore = sectionScores["GRAMMAR_READING"] ?? 0;
  const langReadingScore =
    sectionScores["language_knowledge_and_reading"] ??
    vocabScore + grammarReadingScore;
  const listeningScore =
    sectionScores["listening"] ?? sectionScores["LISTENING"] ?? 0;

  const minimums = exam.sectional_minimums || {};
  const langReadingMin = minimums["language_knowledge_and_reading"] ?? 38;
  const listeningMin = minimums["listening"] ?? 19;

  // Determine explicit pass/fail reasons
  const failReasons: string[] = [];
  if (totalScore < totalRequired) {
    failReasons.push(
      `Total score (${totalScore}) was below the required ${totalRequired} points.`
    );
  }
  if (langReadingScore < langReadingMin) {
    failReasons.push(
      `Language Knowledge & Reading (${langReadingScore}) was below the sectional minimum of ${langReadingMin} points.`
    );
  }
  if (listeningScore < listeningMin) {
    failReasons.push(
      `Listening (${listeningScore}) was below the sectional minimum of ${listeningMin} points.`
    );
  }

  const correctCount = reviewQuestions.filter((q) => q.is_correct).length;
  const accuracyPct =
    reviewQuestions.length > 0
      ? Math.round((correctCount / reviewQuestions.length) * 100)
      : 0;

  const scoreBars = [
    {
      label: "Total Score",
      sublabel: "Overall JLPT Scaled Score",
      score: totalScore,
      max: maxTotalScore,
      minRequired: totalRequired,
    },
    {
      label: "Language Knowledge & Reading",
      sublabel: `Vocabulary (${vocabScore}/60) + Grammar & Reading (${grammarReadingScore}/60)`,
      score: langReadingScore,
      max: 120,
      minRequired: langReadingMin,
    },
    {
      label: "Listening (聴解)",
      sublabel: "Listening Comprehension",
      score: listeningScore,
      max: 60,
      minRequired: listeningMin,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E293B]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E293B] transition hover:border-[#0F766E] hover:text-[#0F766E]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="text-right">
            <span className="rounded bg-[#0F766E] px-2 py-0.5 text-xs font-bold text-white">
              JLPT {exam.level}
            </span>
            <span className="ml-2 text-xs font-bold text-[#1E293B]">
              {exam.title}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {/* Prominent PASSED / NOT PASSED Verdict Banner */}
        <div
          className={`rounded-2xl border p-6 shadow-sm sm:p-8 ${
            passed
              ? "border-emerald-300 bg-emerald-50/80"
              : "border-red-300 bg-red-50/80"
          }`}
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3.5">
              {passed ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                  <XCircle className="h-7 w-7" />
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${
                      passed ? "text-emerald-900" : "text-red-900"
                    }`}
                  >
                    {passed ? "PASSED (合格)" : "NOT PASSED (不合格)"}
                  </h1>
                </div>

                {passed ? (
                  <p className="mt-1.5 text-sm text-emerald-800">
                    Congratulations! You met both the overall pass mark ({totalRequired}/
                    {maxTotalScore}) and every sectional minimum threshold.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1 text-sm text-red-800">
                    <p className="font-semibold">
                      Official JLPT requires meeting BOTH total and sectional minimums:
                    </p>
                    <ul className="list-disc pl-5 text-xs sm:text-sm">
                      {failReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/80 bg-white px-5 py-3 text-center shadow-sm tabular-nums">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Final Score
              </p>
              <p className="mt-0.5 text-3xl font-extrabold text-[#1E293B]">
                {totalScore}
                <span className="text-base font-semibold text-slate-400">
                  /{maxTotalScore}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Stats Strip: Accuracy & Time Taken */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-black/5 pt-5 sm:grid-cols-3 tabular-nums">
            <div className="rounded-xl bg-white/90 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Target className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Question Accuracy</span>
              </div>
              <p className="mt-1 text-lg font-bold text-[#1E293B]">
                {accuracyPct}%{" "}
                <span className="text-xs font-normal text-slate-500">
                  ({correctCount}/{reviewQuestions.length})
                </span>
              </p>
            </div>

            <div className="rounded-xl bg-white/90 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Time Taken</span>
              </div>
              <p className="mt-1 text-lg font-bold text-[#1E293B]">
                {formatDurationMinutes(attempt.started_at, attempt.completed_at)}
              </p>
            </div>

            <div className="col-span-2 rounded-xl bg-white/90 p-3.5 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Award className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Pass Threshold</span>
              </div>
              <p className="mt-1 text-lg font-bold text-[#1E293B]">
                {totalRequired} pts{" "}
                <span className="text-xs font-normal text-slate-500">
                  (Min {langReadingMin} / {listeningMin})
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Sectional & Total Progress Bars with Threshold Markers */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#1E293B]">
              Score Breakdown &amp; Sectional Minimums
            </h2>
            <span className="text-xs text-slate-500">
              Vertical marker indicates minimum passing score
            </span>
          </div>

          <div className="mt-5 space-y-6">
            {scoreBars.map((bar) => {
              const scorePct = Math.min(100, Math.round((bar.score / bar.max) * 100));
              const thresholdPct = Math.min(
                100,
                Math.round((bar.minRequired / bar.max) * 100)
              );
              const metThreshold = bar.score >= bar.minRequired;

              return (
                <div key={bar.label} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#1E293B]">{bar.label}</p>
                      <p className="text-xs text-slate-500">{bar.sublabel}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <span
                        className={`text-base font-extrabold ${
                          metThreshold ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {bar.score}
                      </span>
                      <span className="text-xs text-slate-500">
                        {" "}
                        / {bar.max} pts (Min: {bar.minRequired})
                      </span>
                    </div>
                  </div>

                  {/* Progress Track + Vertical Threshold Line */}
                  <div className="relative h-3.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metThreshold ? "bg-[#0F766E]" : "bg-red-500"
                      }`}
                      style={{ width: `${scorePct}%` }}
                    />
                    <div
                      className="absolute -top-1.5 bottom-[-6px] w-0.5 bg-[#D97706]"
                      style={{ left: `${thresholdPct}%` }}
                      title={`Minimum Pass Threshold: ${bar.minRequired} pts`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Interactive 6-Language Answer Review */}
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-[#1E293B]">
              Detailed Answer Review &amp; Explanations
            </h2>
            <p className="text-xs text-slate-500">
              Switch explanation languages anytime or filter by incorrect and flagged questions.
            </p>
          </div>

          <AnswerReviewList
            questions={reviewQuestions}
            initialLang={preferredLang}
          />
        </div>
      </main>
    </div>
  );
}
