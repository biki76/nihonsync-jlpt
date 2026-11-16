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
  explanation: Record<string, string> | null;
  selected_option: number | null;
  is_flagged: boolean;
  is_correct: boolean;
}

interface AnswerReviewListProps {
  items: ReviewQuestionItem[];
  initialLang: SupportedLang;
}

type FilterMode = "all" | "incorrect" | "flagged";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export function AnswerReviewList({
  items,
  initialLang,
}: AnswerReviewListProps) {
  const [selectedLang, setSelectedLang] = useState<SupportedLang>(
    initialLang || "en"
  );
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showFurigana, setShowFurigana] = useState(true);
  const [openTranscripts, setOpenTranscripts] = useState<
    Record<string, boolean>
  >({});
  const [openPassages, setOpenPassages] = useState<Record<string, boolean>>({});

  const incorrectCount = useMemo(
    () => items.filter((i) => !i.is_correct).length,
    [items]
  );
  const flaggedCount = useMemo(
    () => items.filter((i) => i.is_flagged).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (filter === "incorrect") {
      return items.filter((i) => !i.is_correct);
    }
    if (filter === "flagged") {
      return items.filter((i) => i.is_flagged);
    }
    return items;
  }, [items, filter]);

  function toggleTranscript(questionId: string) {
    setOpenTranscripts((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }

  function togglePassage(questionId: string) {
    setOpenPassages((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }

  function resolveExplanation(
    explanationMap: Record<string, string> | null
  ): { text: string; isFallback: boolean } {
    if (!explanationMap) {
      return {
        text: "No explanation available for this question.",
        isFallback: false,
      };
    }

    const chosen =
      explanationMap[selectedLang] ??
      explanationMap[selectedLang.toUpperCase()];
    if (chosen && chosen.trim().length > 0) {
      return { text: chosen, isFallback: false };
    }

    const fallbackEn = explanationMap.en ?? explanationMap.EN;
    if (fallbackEn && fallbackEn.trim().length > 0) {
      return {
        text: fallbackEn,
        isFallback: selectedLang !== "en",
      };
    }

    const firstAvailable = Object.values(explanationMap).find(
      (v) => typeof v === "string" && v.trim().length > 0
    );
    return {
      text: firstAvailable || "No explanation available for this question.",
      isFallback: selectedLang !== "en",
    };
  }

  return (
    <section className={showFurigana ? "" : "hide-furigana"}>
      {/* Sticky Filter & 8-Language Control Bar */}
      <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-4 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          {/* Filter Tabs (Flexible padding so long localized words never clip) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              style={{ padding: "10px 14px" }}
              className={`min-h-[44px] rounded-xl text-xs font-bold leading-snug transition ${
                filter === "all"
                  ? "bg-[#E04F33] text-white shadow-xs"
                  : "border border-[#E6E2DA] bg-[#FAF9F7] text-[#52525B] hover:border-[#E04F33] hover:text-[#18181B] dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#A1A1AA]"
              }`}
            >
              All Questions ({items.length})
            </button>

            <button
              type="button"
              onClick={() => setFilter("incorrect")}
              style={{ padding: "10px 14px" }}
              className={`min-h-[44px] rounded-xl text-xs font-bold leading-snug transition ${
                filter === "incorrect"
                  ? "bg-[#E04F33] text-white shadow-xs"
                  : "border border-[#E6E2DA] bg-[#FAF9F7] text-[#52525B] hover:border-[#E04F33] hover:text-[#18181B] dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#A1A1AA]"
              }`}
            >
              Incorrect Only ({incorrectCount})
            </button>

            <button
              type="button"
              onClick={() => setFilter("flagged")}
              style={{ padding: "10px 14px" }}
              className={`min-h-[44px] rounded-xl text-xs font-bold leading-snug transition ${
                filter === "flagged"
                  ? "border-[1.5px] border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                  : "border border-[#E6E2DA] bg-[#FAF9F7] text-[#52525B] hover:border-[#E04F33] hover:text-[#18181B] dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#A1A1AA]"
              }`}
            >
              Flagged ({flaggedCount})
            </button>
          </div>

          {/* 8-Language Switcher & Furigana Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFurigana((v) => !v)}
              className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                showFurigana
                  ? "border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                  : "border-[#E6E2DA] bg-white text-[#52525B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]"
              }`}
            >
              ふりがな: {showFurigana ? "ON" : "OFF"}
            </button>

            <div className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] px-3 py-2 dark:border-[#2E2E32] dark:bg-[#111113]">
              <Globe className="h-4 w-4 shrink-0 text-[#E04F33]" />
              <label htmlFor="review-lang-select" className="sr-only">
                Explanation Language
              </label>
              <select
                id="review-lang-select"
                value={selectedLang}
                onChange={(e) =>
                  setSelectedLang(e.target.value as SupportedLang)
                }
                className="bg-transparent text-xs font-bold text-[#18181B] outline-none dark:text-[#F4F4F5]"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option
                    key={l.code}
                    value={l.code}
                    className="bg-white text-[#18181B] dark:bg-[#18181B] dark:text-[#F4F4F5]"
                  >
                    {l.code.toUpperCase()} — {l.native}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Review Question Cards */}
      <div className="mt-5 space-y-5">
        {filteredItems.length === 0 ? (
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-8 text-center text-sm text-[#52525B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]">
            No questions match the selected filter.
          </div>
        ) : (
          filteredItems.map((item) => {
            const { text: explanationText, isFallback } = resolveExplanation(
              item.explanation
            );
            const isStarQuestion =
              item.question_type === "sentence_grammar_2_star";
            const transcriptVisible = Boolean(
              openTranscripts[item.question_id]
            );
            const passageVisible = Boolean(openPassages[item.question_id]);

            const orderedSequenceOptions =
              isStarQuestion &&
              Array.isArray(item.correct_sequence) &&
              item.correct_sequence.length > 0
                ? item.correct_sequence
                    .map((optIdx) =>
                      item.options.find((o) => o.index === optIdx)
                    )
                    .filter((o): o is QuestionOption => Boolean(o))
                : [];

            return (
              <article
                key={item.question_id}
                className={`rounded-[16px] border bg-white p-5 shadow-xs dark:bg-[#18181B] ${
                  item.is_correct
                    ? "border-emerald-200 dark:border-emerald-900/60"
                    : "border-[#E04F33]/50"
                }`}
              >
                {/* Header Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E2DA] pb-3 dark:border-[#2E2E32]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#18181B] text-xs font-bold text-white tabular-nums dark:bg-[#F4F4F5] dark:text-[#18181B]">
                      {item.question_number}
                    </span>

                    {item.is_correct ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Correct (+{item.points} pts)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF2EF] px-2.5 py-0.5 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                        <XCircle className="h-3.5 w-3.5" />
                        {item.selected_option === null
                          ? "Unanswered"
                          : "Incorrect"}{" "}
                        (0/{item.points} pts)
                      </span>
                    )}

                    {item.is_flagged && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#E04F33]/40 bg-[#FDF2EF] px-2.5 py-0.5 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                        <Flag className="h-3 w-3 fill-[#E04F33]" />
                        Flagged
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
                    Section {item.section_number} • 問題 {item.mondai_number}
                  </span>
                </div>

                {/* Optional Reading Passage Drawer */}
                {item.passage_html && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => togglePassage(item.question_id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] px-3 py-1.5 text-xs font-bold text-[#18181B] transition hover:border-[#E04F33] dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#F4F4F5]"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[#E04F33]" />
                      <span>
                        {passageVisible
                          ? "Hide Reading Passage"
                          : "View Reading Passage"}
                      </span>
                      {passageVisible ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {passageVisible && (
                      <div className="mt-2.5 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-4 dark:border-[#2E2E32] dark:bg-[#111113]">
                        <JapaneseHtmlText
                          html={item.passage_html}
                          className="space-y-2 text-sm text-[#18181B] dark:text-[#F4F4F5]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Unlocked Listening Audio Player (Review Mode) */}
                {item.audio_url && (
                  <ListeningAudioPlayer
                    audioUrl={item.audio_url}
                    imageUrl={item.image_url}
                    mode="review"
                  />
                )}

                {/* Question Prompt */}
                <JapaneseHtmlText
                  html={item.prompt_html}
                  className="mt-3.5 text-base font-medium text-[#18181B] dark:text-[#F4F4F5]"
                />

                {/* Star Question (★) Reconstructed Sequence */}
                {orderedSequenceOptions.length > 0 && (
                  <div className="mt-3.5 rounded-xl border border-[#E04F33]/35 bg-[#FDF2EF] p-3.5 dark:bg-[#E04F33]/12">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#E04F33]">
                      <Star className="h-3.5 w-3.5 fill-[#E04F33]" />
                      <span>Correct Word Order (1 → 2 → 3★ → 4)</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {orderedSequenceOptions.map((seqOpt, idx) => (
                        <div
                          key={`${seqOpt.index}-${idx}`}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                            seqOpt.index === item.correct_option
                              ? "border-[#E04F33] bg-white text-[#E04F33] shadow-xs dark:bg-[#18181B]"
                              : "border-[#E6E2DA] bg-white text-[#18181B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
                          }`}
                        >
                          <span className="text-[10px] text-[#52525B] dark:text-[#A1A1AA]">
                            {idx + 1}
                            {seqOpt.index === item.correct_option ? "★" : ""}:
                          </span>
                          <JapaneseHtmlText as="span" html={seqOpt.text} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Options Comparison Grid */}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {item.options.map((opt, idx) => {
                    const isUserPick = item.selected_option === opt.index;
                    const isTrueAnswer = item.correct_option === opt.index;
                    const letter = OPTION_LETTERS[idx] ?? String(opt.index);

                    let cardStyle =
                      "border-[#E6E2DA] bg-white text-[#18181B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]";
                    if (isTrueAnswer) {
                      cardStyle =
                        "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium dark:bg-emerald-950/30 dark:text-emerald-200";
                    } else if (isUserPick && !isTrueAnswer) {
                      cardStyle =
                        "border-[#E04F33] bg-[#FDF2EF] text-[#18181B] dark:bg-[#E04F33]/15 dark:text-[#F4F4F5]";
                    }

                    return (
                      <div
                        key={opt.index}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${cardStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-xs font-bold tabular-nums ${
                              isTrueAnswer
                                ? "bg-emerald-600 text-white"
                                : isUserPick
                                ? "bg-[#E04F33] text-white"
                                : "bg-[#F3F1ED] text-[#18181B] dark:bg-[#27272A] dark:text-[#F4F4F5]"
                            }`}
                          >
                            {letter}
                          </span>
                          <JapaneseHtmlText
                            as="span"
                            html={opt.text}
                            className="text-sm"
                          />
                        </div>

                        <div className="flex shrink-0 items-center gap-1 text-[11px] font-bold">
                          {isUserPick && (
                            <span
                              className={`rounded-md px-2 py-0.5 ${
                                isTrueAnswer
                                  ? "bg-emerald-600 text-white"
                                  : "bg-[#E04F33] text-white"
                              }`}
                            >
                              Your Pick
                            </span>
                          )}
                          {isTrueAnswer && !isUserPick && (
                            <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-white">
                              Answer
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expandable Japanese Transcript for Listening */}
                {item.transcript_ja && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => toggleTranscript(item.question_id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] px-3 py-1.5 text-xs font-bold text-[#18181B] transition hover:border-[#E04F33] dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#F4F4F5]"
                    >
                      <FileText className="h-3.5 w-3.5 text-[#E04F33]" />
                      <span>
                        {transcriptVisible
                          ? "Hide Japanese Transcript"
                          : "Show Japanese Transcript (スクリプト)"}
                      </span>
                      {transcriptVisible ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {transcriptVisible && (
                      <div className="mt-2.5 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-4 dark:border-[#2E2E32] dark:bg-[#111113]">
                        <JapaneseHtmlText
                          html={item.transcript_ja.replace(/\n/g, "<br/>")}
                          className="text-sm text-[#18181B] dark:text-[#F4F4F5]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Localized Explanation Card */}
                <div className="mt-4 rounded-xl border border-[#E6E2DA] bg-[#FAF9F7] p-4 dark:border-[#2E2E32] dark:bg-[#111113]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E04F33]">
                      Explanation ({selectedLang.toUpperCase()})
                    </span>
                    {isFallback && (
                      <span className="text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
                        Showing English fallback
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#18181B] dark:text-[#F4F4F5]">
                    {explanationText}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
