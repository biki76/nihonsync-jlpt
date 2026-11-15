"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Flag,
  LayoutGrid,
  Loader2,
  X,
} from "lucide-react";
import { SectionTimer } from "@/components/exam/SectionTimer";
import {
  QuestionPalette,
  type PaletteItem,
} from "@/components/exam/QuestionPalette";
import { JapaneseHtmlText } from "@/components/exam/JapaneseHtmlText";
import { ReadingSplitPane } from "@/components/exam/ReadingSplitPane";
import { StarQuestionDisplay } from "@/components/exam/StarQuestionDisplay";
import { ListeningAudioPlayer } from "@/components/exam/ListeningAudioPlayer";
import {
  saveAnswer,
  submitCurrentSection,
} from "@/app/actions/examActions";
import type {
  Exam,
  ExamSection,
  MondaiGroup,
  PublicQuestion,
  UserAnswer,
  UserAttempt,
} from "@/types/jlpt";

export interface MondaiWithQuestions extends MondaiGroup {
  questions: PublicQuestion[];
}

interface ExamWorkspaceProps {
  exam: Exam;
  attempt: UserAttempt;
  sections: ExamSection[];
  activeSection: ExamSection;
  mondaiGroups: MondaiWithQuestions[];
  initialAnswers: UserAnswer[];
  serverNowIso: string;
}

export function ExamWorkspace({
  exam,
  attempt,
  sections,
  activeSection,
  mondaiGroups,
  initialAnswers,
  serverNowIso,
}: ExamWorkspaceProps) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [answersMap, setAnswersMap] = useState<
    Record<string, { selectedOption: number | null; isFlagged: boolean }>
  >(() => {
    const initial: Record<
      string,
      { selectedOption: number | null; isFlagged: boolean }
    > = {};
    for (const ans of initialAnswers) {
      initial[ans.question_id] = {
        selectedOption: ans.selected_option,
        isFlagged: ans.is_flagged,
      };
    }
    return initial;
  });

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [showFurigana, setShowFurigana] = useState(true);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    mondaiGroups[0]?.questions[0]?.id ?? null
  );
  const [isSubmittingSection, setIsSubmittingSection] = useState(false);

  const allQuestions = useMemo(
    () => mondaiGroups.flatMap((mg) => mg.questions),
    [mondaiGroups]
  );

  const paletteItems: PaletteItem[] = useMemo(
    () =>
      allQuestions.map((q) => {
        const entry = answersMap[q.id];
        return {
          questionId: q.id,
          questionNumber: q.question_number,
          isAnswered:
            entry?.selectedOption !== null && entry?.selectedOption !== undefined,
          isFlagged: Boolean(entry?.isFlagged),
        };
      }),
    [allQuestions, answersMap]
  );

  async function handleSelectOption(questionId: string, optionIndex: number) {
    setActiveQuestionId(questionId);
    const prev = answersMap[questionId] ?? {
      selectedOption: null,
      isFlagged: false,
    };

    const nextEntry = {
      selectedOption: optionIndex,
      isFlagged: prev.isFlagged,
    };

    setAnswersMap((curr) => ({ ...curr, [questionId]: nextEntry }));
    setSaveState("saving");

    const res = await saveAnswer(
      attempt.id,
      questionId,
      nextEntry.selectedOption,
      nextEntry.isFlagged
    );
    setSaveState(res.ok ? "saved" : "error");
  }

  async function handleToggleFlag(questionId: string) {
    setActiveQuestionId(questionId);
    const prev = answersMap[questionId] ?? {
      selectedOption: null,
      isFlagged: false,
    };

    const nextEntry = {
      selectedOption: prev.selectedOption,
      isFlagged: !prev.isFlagged,
    };

    setAnswersMap((curr) => ({ ...curr, [questionId]: nextEntry }));
    setSaveState("saving");

    const res = await saveAnswer(
      attempt.id,
      questionId,
      nextEntry.selectedOption,
      nextEntry.isFlagged
    );
    setSaveState(res.ok ? "saved" : "error");
  }

  function scrollToQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setMobilePaletteOpen(false);
    const el = document.getElementById(`question-${questionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const handleAdvanceSection = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmittingSection(true);

    try {
      const result = await submitCurrentSection(attempt.id);
      if (result.completed && result.redirectTo) {
        router.push(result.redirectTo);
      } else {
        submittingRef.current = false;
        setIsSubmittingSection(false);
        router.refresh();
      }
    } catch {
      submittingRef.current = false;
      setIsSubmittingSection(false);
    }
  }, [attempt.id, router]);

  function handleManualSubmitClick() {
    const unanswered = paletteItems.filter((p) => !p.isAnswered).length;
    const isLastSection = activeSection.section_number >= sections.length;
    const msg = isLastSection
      ? `Submit final section and finish exam? (${unanswered} unanswered in this section)`
      : `Submit Section ${activeSection.section_number} and move to Section ${
          activeSection.section_number + 1
        }? You cannot return to this section. (${unanswered} unanswered)`;

    if (window.confirm(msg)) {
      handleAdvanceSection();
    }
  }

  function renderQuestionCard(mg: MondaiWithQuestions, q: PublicQuestion) {
    const currentAnswer = answersMap[q.id];
    const selected = currentAnswer?.selectedOption ?? null;
    const flagged = Boolean(currentAnswer?.isFlagged);
    const isStarQuestion = mg.question_type === "sentence_grammar_2_star";
    const isThreeOptionQuickResponse = q.options.length === 3;

    return (
      <div
        key={q.id}
        id={`question-${q.id}`}
        className={`rounded-xl border bg-white p-5 shadow-sm transition ${
          flagged
            ? "border-amber-300 ring-1 ring-amber-200"
            : "border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-[#1E293B] tabular-nums">
              {q.question_number}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              {q.points} {q.points === 1 ? "pt" : "pts"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleToggleFlag(q.id)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              flagged
                ? "border-amber-300 bg-[#FFFBEB] text-[#D97706]"
                : "border-slate-200 bg-white text-slate-500 hover:text-[#1E293B]"
            }`}
          >
            <Flag
              className={`h-3.5 w-3.5 ${flagged ? "fill-[#D97706]" : ""}`}
            />
            <span>{flagged ? "Flagged" : "Flag"}</span>
          </button>
        </div>

        {/* Listening Audio Player + Optional Visual Sheet */}
        {q.audio_url && (
          <ListeningAudioPlayer
            audioUrl={q.audio_url}
            imageUrl={q.image_url}
            mode="exam"
            maxPlays={2}
          />
        )}

        {/* Star Question (★) Visual Breakdown vs Standard Prompt */}
        {isStarQuestion ? (
          <StarQuestionDisplay
            promptHtml={q.prompt_html}
            options={q.options}
            selectedOption={selected}
          />
        ) : (
          <JapaneseHtmlText
            html={q.prompt_html}
            className="mt-3 text-base font-medium text-[#1E293B] sm:text-lg"
          />
        )}

        {/* Dynamic 3-Option (Mondai 4 Quick Response) vs 4-Option Layout */}
        <div
          className={`mt-4 grid gap-2.5 ${
            isThreeOptionQuickResponse ? "grid-cols-1" : "sm:grid-cols-2"
          }`}
        >
          {q.options.map((opt) => {
            const isSelected = selected === opt.index;

            return (
              <button
                key={opt.index}
                type="button"
                onClick={() => handleSelectOption(q.id, opt.index)}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                  isSelected
                    ? "border-[#0F766E] bg-[#F0FDFA] text-[#0F766E] shadow-sm"
                    : "border-slate-200 bg-white text-[#1E293B] hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums ${
                    isSelected
                      ? "border-[#0F766E] bg-[#0F766E] text-white"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  {opt.index}
                </span>
                <JapaneseHtmlText
                  as="span"
                  html={opt.text}
                  className="text-sm font-medium sm:text-base"
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isLastSection = activeSection.section_number >= sections.length;

  return (
    <div
      className={`min-h-screen bg-[#FAFAFA] text-[#1E293B] ${
        showFurigana ? "" : "hide-furigana"
      }`}
    >
      {/* Sticky Top Exam Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-[#0F766E] px-2 py-0.5 text-xs font-bold text-white">
              {exam.level}
            </span>
            <div>
              <p className="text-xs font-bold text-[#1E293B] sm:text-sm">
                {exam.title}
              </p>
              <p className="text-[11px] text-slate-500">
                Section {activeSection.section_number}/{sections.length}:{" "}
                <span className="font-jp font-medium text-slate-700">
                  {activeSection.section_title_ja}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Save Status Indicator */}
            <div className="hidden items-center gap-1 text-xs sm:flex">
              {saveState === "saving" && (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0F766E]" />
                  Saving...
                </span>
              )}
              {saveState === "saved" && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
              {saveState === "error" && (
                <span className="text-red-600">Save failed</span>
              )}
            </div>

            {/* Furigana Toggle */}
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

            {/* Server-Backed Section Timer */}
            <SectionTimer
              key={`${attempt.id}-${activeSection.section_number}-${attempt.section_started_at}`}
              sectionStartedAt={attempt.section_started_at}
              timeLimitMinutes={activeSection.time_limit_minutes}
              serverNowIso={serverNowIso}
              onExpire={handleAdvanceSection}
            />

            {/* Mobile Palette Trigger */}
            <button
              type="button"
              onClick={() => setMobilePaletteOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 lg:hidden"
              aria-label="Toggle question palette"
            >
              <LayoutGrid className="h-4 w-4 text-[#0F766E]" />
              <span className="tabular-nums">
                {paletteItems.filter((i) => i.isAnswered).length}/
                {paletteItems.length}
              </span>
            </button>

            {/* Submit Section Button */}
            <button
              type="button"
              disabled={isSubmittingSection}
              onClick={handleManualSubmitClick}
              className="inline-flex items-center gap-1 rounded-lg bg-[#0F766E] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#115E59] disabled:opacity-60"
            >
              {isSubmittingSection ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>{isLastSection ? "Finish Exam" : "Next Section"}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Collapsible Question Palette Drawer */}
      {mobilePaletteOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden">
          <div className="mx-auto mt-16 max-w-md px-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
              <QuestionPalette
                items={paletteItems}
                activeQuestionId={activeQuestionId}
                onSelectQuestion={scrollToQuestion}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Grid */}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_270px]">
        <div className="space-y-8">
          {mondaiGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No questions found for this section.
            </div>
          ) : (
            mondaiGroups.map((mg) => {
              const questionCards = mg.questions.map((q) =>
                renderQuestionCard(mg, q)
              );

              return (
                <section key={mg.id} className="space-y-4">
                  {/* Mondai Header & Instruction */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="inline-block rounded bg-[#F0FDFA] px-2.5 py-0.5 text-xs font-bold text-[#0F766E]">
                      問題 {mg.mondai_number}
                    </span>
                    <JapaneseHtmlText
                      html={mg.instruction_ja}
                      className="mt-2 text-base font-medium text-[#1E293B]"
                    />
                  </div>

                  {/* Split-Screen Reader when passage_html is present, else standard stack */}
                  {mg.passage_html ? (
                    <ReadingSplitPane
                      mondaiNumber={mg.mondai_number}
                      passageHtml={mg.passage_html}
                    >
                      {questionCards}
                    </ReadingSplitPane>
                  ) : (
                    <div className="space-y-4">{questionCards}</div>
                  )}
                </section>
              );
            })
          )}
        </div>

        {/* Desktop Sticky Question Palette Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <QuestionPalette
              items={paletteItems}
              activeQuestionId={activeQuestionId}
              onSelectQuestion={scrollToQuestion}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
