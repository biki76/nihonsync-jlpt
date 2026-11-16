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

const OPTION_LETTERS = ["A", "B", "C", "D"];

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
        className={`rounded-[16px] border bg-white p-5 shadow-xs transition dark:bg-[#18181B] ${
          flagged
            ? "border-[#E04F33] ring-1 ring-[#E04F33]/30"
            : "border-[#E6E2DA] dark:border-[#2E2E32]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F1ED] text-xs font-bold text-[#18181B] tabular-nums dark:bg-[#27272A] dark:text-[#F4F4F5]">
              {q.question_number}
            </span>
            <span className="text-xs text-[#52525B] tabular-nums dark:text-[#A1A1AA]">
              {q.points} {q.points === 1 ? "pt" : "pts"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleToggleFlag(q.id)}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              flagged
                ? "border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                : "border-[#E6E2DA] bg-white text-[#52525B] hover:border-[#E04F33] hover:text-[#18181B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]"
            }`}
          >
            <Flag
              className={`h-3.5 w-3.5 ${flagged ? "fill-[#E04F33]" : ""}`}
            />
            <span>{flagged ? "Flagged" : "Flag"}</span>
          </button>
        </div>

        {q.audio_url && (
          <ListeningAudioPlayer
            audioUrl={q.audio_url}
            imageUrl={q.image_url}
            mode="exam"
            maxPlays={2}
          />
        )}

        {isStarQuestion ? (
          <StarQuestionDisplay
            promptHtml={q.prompt_html}
            options={q.options}
            selectedOption={selected}
          />
        ) : (
          <JapaneseHtmlText
            html={q.prompt_html}
            className="mt-3 text-base font-medium text-[#18181B] dark:text-[#F4F4F5] sm:text-lg"
          />
        )}

        <div
          className={`mt-4 grid gap-2.5 ${
            isThreeOptionQuickResponse ? "grid-cols-1" : "sm:grid-cols-2"
          }`}
        >
          {q.options.map((opt, idx) => {
            const isSelected = selected === opt.index;
            const letter = OPTION_LETTERS[idx] ?? String(opt.index);

            return (
              <button
                key={opt.index}
                type="button"
                onClick={() => handleSelectOption(q.id, opt.index)}
                className={`flex min-h-[48px] items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition ${
                  isSelected
                    ? "border-[1.5px] border-[#E04F33] bg-[#FDF2EF] text-[#18181B] dark:bg-[#E04F33]/15 dark:text-[#F4F4F5]"
                    : "border border-[#E6E2DA] bg-white text-[#18181B] hover:border-[#E04F33]/50 dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] text-xs font-bold tabular-nums ${
                      isSelected
                        ? "bg-[#E04F33] text-white"
                        : "bg-[#F3F1ED] text-[#18181B] dark:bg-[#27272A] dark:text-[#F4F4F5]"
                    }`}
                  >
                    {letter}
                  </span>
                  <JapaneseHtmlText
                    as="span"
                    html={opt.text}
                    className="text-sm font-medium sm:text-base"
                  />
                </div>
                {isSelected && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E04F33] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
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
      className={`min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5] ${
        showFurigana ? "" : "hide-furigana"
      }`}
    >
      <header className="sticky top-0 z-30 border-b border-[#E6E2DA] bg-white/95 backdrop-blur dark:border-[#2E2E32] dark:bg-[#18181B]/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-[#18181B] px-2.5 py-1 text-xs font-bold text-white dark:bg-[#F4F4F5] dark:text-[#18181B]">
              {exam.level}
            </span>
            <div>
              <p className="text-xs font-bold sm:text-sm">
                {exam.title}
              </p>
              <p className="text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
                Section {activeSection.section_number}/{sections.length}:{" "}
                <span className="font-jp font-semibold text-[#18181B] dark:text-[#F4F4F5]">
                  {activeSection.section_title_ja}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1 text-xs sm:flex">
              {saveState === "saving" && (
                <span className="inline-flex items-center gap-1 text-[#52525B] dark:text-[#A1A1AA]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E04F33]" />
                  Saving...
                </span>
              )}
              {saveState === "saved" && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#E04F33]">
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
              {saveState === "error" && (
                <span className="font-semibold text-[#E04F33]">Save failed</span>
              )}
            </div>

            <SectionTimer
              key={`${attempt.id}-${activeSection.section_number}-${attempt.section_started_at}`}
              sectionStartedAt={attempt.section_started_at}
              timeLimitMinutes={activeSection.time_limit_minutes}
              serverNowIso={serverNowIso}
              onExpire={handleAdvanceSection}
            />

            <button
              type="button"
              onClick={() => setMobilePaletteOpen((v) => !v)}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#E6E2DA] bg-white px-2.5 py-1.5 text-xs font-bold text-[#18181B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5] lg:hidden"
              aria-label="Toggle question palette"
            >
              <LayoutGrid className="h-4 w-4 text-[#E04F33]" />
              <span className="tabular-nums">
                {paletteItems.filter((i) => i.isAnswered).length}/
                {paletteItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowFurigana((v) => !v)}
              className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                showFurigana
                  ? "border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                  : "border-[#E6E2DA] bg-white text-[#52525B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]"
              }`}
            >
              ふりがな: {showFurigana ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              disabled={isSubmittingSection}
              onClick={handleManualSubmitClick}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-[#E04F33] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#C83E24] disabled:opacity-60"
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

      {mobilePaletteOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden">
          <div className="mx-auto mt-16 max-w-md px-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                className="absolute right-3 top-3 rounded-lg p-1 text-[#52525B] hover:bg-[#F3F1ED] dark:text-[#A1A1AA] dark:hover:bg-[#27272A]"
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

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_270px]">
        <div className="space-y-8">
          {mondaiGroups.length === 0 ? (
            <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-8 text-center text-sm text-[#52525B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]">
              No questions found for this section.
            </div>
          ) : (
            mondaiGroups.map((mg) => {
              const questionCards = mg.questions.map((q) =>
                renderQuestionCard(mg, q)
              );

              return (
                <section key={mg.id} className="space-y-4">
                  <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-5 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
                    <span className="inline-block rounded-lg bg-[#FDF2EF] px-2.5 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                      問題 {mg.mondai_number}
                    </span>
                    <JapaneseHtmlText
                      html={mg.instruction_ja}
                      className="mt-2 text-base font-medium text-[#18181B] dark:text-[#F4F4F5]"
                    />
                  </div>

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
