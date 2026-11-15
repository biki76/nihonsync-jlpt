"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Flag,
  Globe,
  HelpCircle,
  Star,
  XCircle,
} from "lucide-react";
import { JapaneseHtmlText } from "@/components/exam/JapaneseHtmlText";
import { ListeningAudioPlayer } from "@/components/exam/ListeningAudioPlayer";
import {
  SUPPORTED_LANGUAGES,
  type QuestionOption,
  type SupportedLang,
} from "@/types/jlpt";

export interface ReviewQuestionItem {
  question_id: string;
  section_number: number;
  section_code: string;
  section_title_ja: string;
  section_title_en: string;
  mondai_number: number;
  question_type: string;
  instruction_ja: string;
  passage_html: string | null;
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
  selected_option: number | null;
  is_flagged: boolean;
  is_correct: boolean;
}

interface AnswerReviewListProps {
  questions: ReviewQuestionItem[];
  initialLang: SupportedLang;
}

type FilterMode = "all" | "incorrect" | "flagged";

export function AnswerReviewList({
  questions,
  initialLang,
}: AnswerReviewListProps) {
  const [selectedLang, setSelectedLang] = useState<SupportedLang>(initialLang);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showFurigana, setShowFurigana] = useState(true);
  const [openTranscripts, setOpenTranscripts] = useState<Record<string, boolean>>({});
  const [openPassages, setOpenPassages] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const incorrect = questions.filter((q) => !q.is_correct).length;
    const flagged = questions.filter((q) => q.is_flagged).length;
    return {
      all: questions.length,
      incorrect,
      flagged,
    };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (filter === "incorrect") {
      return questions.filter((q) => !q.is_correct);
    }
    if (filter === "flagged") {
      return questions.filter((q) => q.is_flagged);
    }
    return questions;
  }, [questions, filter]);

  function toggleTranscript(questionId: string) {
    setOpenTranscripts((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  function togglePassage(questionId: string) {
    setOpenPassages((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  return (
    <section
      className={`space-y-5 ${showFurigana ? "" : "hide-furigana"}`}
    >
      {/* Review Toolbar: Filter Tabs + Language Switcher + Furigana Toggle */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 transition tabular-nums ${
              filter === "all"
                ? "bg-white text-[#1E293B] shadow-sm"
                : "text-slate-600 hover:text-[#1E293B]"
            }`}
          >
            All Questions ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilter("incorrect")}
            className={`rounded-md px-3 py-1.5 transition tabular-nums ${
              filter === "incorrect"
                ? "bg-white text-red-700 shadow-sm"
                : "text-slate-600 hover:text-[#1E293B]"
            }`}
          >
            Incorrect Only ({counts.incorrect})
          </button>
          <button
            type="button"
            onClick={() => setFilter("flagged")}
            className={`rounded-md px-3 py-1.5 transition tabular-nums ${
              filter === "flagged"
                ? "bg-white text-[#D97706] shadow-sm"
                : "text-slate-600 hover:text-[#1E293B]"
            }`}
          >
            Flagged ({counts.flagged})
          </button>
        </div>

        {/* Language & Furigana Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFurigana((v) => !v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              showFurigana
                ? "border-[#0F766E] bg-[#F0FDFA] text-[#0F766E]"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            ふりがな: {showFurigana ? "ON" : "OFF"}
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#FAFAFA] px-2.5 py-1.5">
            <Globe className="h-4 w-4 text-[#0F766E]" />
            <label htmlFor="review-lang" className="sr-only">
              Explanation Language
            </label>
            <select
              id="review-lang"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as SupportedLang)}
              className="bg-transparent text-xs font-semibold text-[#1E293B] outline-none"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.code.toUpperCase()} — {lang.native}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filtered Question Cards */}
      {filteredQuestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No questions match the current filter.
        </div>
      ) : (
        <div className="space-y-5">
          {filteredQuestions.map((q) => {
            const isUnanswered =
              q.selected_option === null || q.selected_option === undefined;
            const isStarQuestion =
              q.question_type === "sentence_grammar_2_star" &&
              Array.isArray(q.correct_sequence) &&
              q.correct_sequence.length === 4;

            const localizedExplanation =
              q.explanation?.[selectedLang] ||
              q.explanation?.en ||
              "No explanation provided for this question.";
            const usedFallback =
              selectedLang !== "en" && !q.explanation?.[selectedLang];

            const transcriptExpanded = Boolean(openTranscripts[q.question_id]);
            const passageExpanded = Boolean(openPassages[q.question_id]);

            return (
              <article
                key={q.question_id}
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  q.is_correct
                    ? "border-slate-200"
                    : "border-red-200 ring-1 ring-red-100"
                }`}
              >
                {/* Card Top Metadata & Result Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-[#1E293B] tabular-nums">
                      {q.question_number}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Sec {q.section_number} ({q.section_code}) • 問題 {q.mondai_number}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {q.points} {q.points === 1 ? "pt" : "pts"}
                    </span>
                    {q.is_flagged && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#D97706]">
                        <Flag className="h-3 w-3 fill-[#D97706]" />
                        Flagged
                      </span>
                    )}
                  </div>

                  {q.is_correct ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Correct (+{q.points})
                    </span>
                  ) : isUnanswered ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      <HelpCircle className="h-3.5 w-3.5" />
                      Unanswered (0)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                      <XCircle className="h-3.5 w-3.5" />
                      Incorrect (0)
                    </span>
                  )}
                </div>

                {/* Collapsible Reading Passage if present */}
                {q.passage_html && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-[#FAFAFA]">
                    <button
                      type="button"
                      onClick={() => togglePassage(q.question_id)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#0F766E]"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>View Reading Passage</span>
                      </span>
                      {passageExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {passageExpanded && (
                      <div className="border-t border-slate-200 p-4">
                        <JapaneseHtmlText
                          html={q.passage_html}
                          className="space-y-2 text-sm text-[#1E293B] sm:text-base"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Unlocked Listening Audio Player (mode="review") */}
                {q.audio_url && (
                  <ListeningAudioPlayer
                    audioUrl={q.audio_url}
                    imageUrl={q.image_url}
                    mode="review"
                  />
                )}

                {/* Expandable Japanese Transcript for Listening */}
                {q.transcript_ja && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-[#FAFAFA]">
                    <button
                      type="button"
                      onClick={() => toggleTranscript(q.question_id)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-[#0F766E]"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-[#0F766E]" />
                        <span>Japanese Audio Transcript (スクリプト)</span>
                      </span>
                      {transcriptExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {transcriptExpanded && (
                      <div className="border-t border-slate-200 p-4">
                        <pre className="jp-furigana whitespace-pre-wrap font-jp text-sm text-[#1E293B]">
                          {q.transcript_ja}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Question Prompt */}
                <JapaneseHtmlText
                  html={q.prompt_html}
                  className="mt-4 text-base font-medium text-[#1E293B] sm:text-lg"
                />

                {/* Star Question (★) Full Ordered Sentence Reconstruction */}
                {isStarQuestion && q.correct_sequence && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-[#FFFBEB]/70 p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
                      <Star className="h-3.5 w-3.5 fill-[#D97706]" />
                      <span>Correct Word Order (★ = Slot 3)</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {q.correct_sequence.map((optIdx, posIdx) => {
                        const optObj = q.options.find((o) => o.index === optIdx);
                        const isStarSlot = posIdx === 2;
                        return (
                          <div
                            key={`${posIdx}-${optIdx}`}
                            className={`rounded-lg border p-2 text-center ${
                              isStarSlot
                                ? "border-2 border-[#D97706] bg-white shadow-sm"
                                : "border-slate-200 bg-white/90"
                            }`}
                          >
                            <div className="text-[10px] font-bold text-slate-500 tabular-nums">
                              {isStarSlot ? "★ SLOT 3" : `SLOT ${posIdx + 1}`} (#{optIdx})
                            </div>
                            <JapaneseHtmlText
                              as="div"
                              html={optObj?.text ?? ""}
                              className="mt-0.5 text-xs font-bold text-[#1E293B]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Options Comparison (Your Answer vs Correct Key) */}
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const isTrueCorrect = opt.index === q.correct_option;
                    const isUserChoice = opt.index === q.selected_option;

                    let cardStyle =
                      "border-slate-200 bg-white text-slate-700";
                    let badgeStyle =
                      "border-slate-300 text-slate-600";

                    if (isTrueCorrect) {
                      cardStyle =
                        "border-emerald-400 bg-emerald-50/70 text-emerald-950 font-semibold";
                      badgeStyle =
                        "border-emerald-600 bg-emerald-600 text-white";
                    } else if (isUserChoice && !isTrueCorrect) {
                      cardStyle =
                        "border-red-400 bg-red-50/70 text-red-950 font-semibold";
                      badgeStyle =
                        "border-red-600 bg-red-600 text-white";
                    }

                    return (
                      <div
                        key={opt.index}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${cardStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums ${badgeStyle}`}
                          >
                            {opt.index}
                          </span>
                          <JapaneseHtmlText
                            as="span"
                            html={opt.text}
                            className="text-sm sm:text-base"
                          />
                        </div>

                        <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold">
                          {isTrueCorrect && (
                            <span className="rounded bg-emerald-600 px-2 py-0.5 text-white">
                              Correct
                            </span>
                          )}
                          {isUserChoice && !isTrueCorrect && (
                            <span className="rounded bg-red-600 px-2 py-0.5 text-white">
                              Your Choice
                            </span>
                          )}
                          {isUserChoice && isTrueCorrect && (
                            <span className="rounded bg-emerald-800 px-2 py-0.5 text-white">
                              Your Choice
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Localized Explanation Card */}
                <div className="mt-4 rounded-xl border border-teal-200 bg-[#F0FDFA] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
                      Explanation ({selectedLang.toUpperCase()})
                    </span>
                    {usedFallback && (
                      <span className="text-[11px] text-slate-500">
                        Fallback to EN
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#1E293B]">
                    {localizedExplanation}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
