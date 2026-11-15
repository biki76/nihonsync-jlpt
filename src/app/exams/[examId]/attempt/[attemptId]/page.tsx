import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { sanitizeJlptHtml } from "@/utils/sanitize";
import {
  ExamWorkspace,
  type MondaiWithQuestions,
} from "@/components/exam/ExamWorkspace";
import type {
  Exam,
  ExamSection,
  MondaiGroup,
  PublicQuestion,
  UserAnswer,
  UserAttempt,
} from "@/types/jlpt";

interface ActiveAttemptPageProps {
  params: Promise<{ examId: string; attemptId: string }>;
}

export default async function ActiveAttemptPage({
  params,
}: ActiveAttemptPageProps) {
  const { examId, attemptId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/exams/${examId}/attempt/${attemptId}`);
  }

  const [{ data: attemptData }, { data: examData }, { data: sectionsData }] =
    await Promise.all([
      supabase
        .from("user_attempts")
        .select("*")
        .eq("id", attemptId)
        .eq("exam_id", examId)
        .eq("user_id", user.id)
        .single(),
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
    ]);

  if (!attemptData || !examData) {
    notFound();
  }

  const attempt = attemptData as UserAttempt;
  const exam = examData as Exam;
  const sections = (sectionsData as ExamSection[]) ?? [];

  if (attempt.status === "completed") {
    redirect(`/attempts/${attempt.id}/results`);
  }

  const activeSection =
    sections.find((s) => s.section_number === attempt.current_section) ??
    sections[0];

  if (!activeSection) {
    notFound();
  }

  const { data: mondaiData } = await supabase
    .from("mondai_groups")
    .select("*")
    .eq("section_id", activeSection.id)
    .order("mondai_number", { ascending: true });

  const rawMondai = (mondaiData as MondaiGroup[]) ?? [];
  const mondaiIds = rawMondai.map((m) => m.id);

  // Query ONLY the anti-cheat public_questions view (no correct_option exposed)
  let rawQuestions: PublicQuestion[] = [];
  if (mondaiIds.length > 0) {
    const { data: qData } = await supabase
      .from("public_questions")
      .select("*")
      .in("mondai_group_id", mondaiIds)
      .order("question_number", { ascending: true });

    rawQuestions = (qData as PublicQuestion[]) ?? [];
  }

  const questionIds = rawQuestions.map((q) => q.id);
  let initialAnswers: UserAnswer[] = [];
  if (questionIds.length > 0) {
    const { data: ansData } = await supabase
      .from("user_answers")
      .select("*")
      .eq("attempt_id", attempt.id)
      .in("question_id", questionIds);

    initialAnswers = (ansData as UserAnswer[]) ?? [];
  }

  // Sanitize all HTML fields on the server before passing to Client Component
  const mondaiGroups: MondaiWithQuestions[] = rawMondai.map((mg) => ({
    ...mg,
    instruction_ja: sanitizeJlptHtml(mg.instruction_ja),
    passage_html: mg.passage_html ? sanitizeJlptHtml(mg.passage_html) : null,
    questions: rawQuestions
      .filter((q) => q.mondai_group_id === mg.id)
      .map((q) => ({
        ...q,
        prompt_html: sanitizeJlptHtml(q.prompt_html),
        options: q.options.map((opt) => ({
          index: opt.index,
          text: sanitizeJlptHtml(opt.text),
        })),
      })),
  }));

  return (
    <ExamWorkspace
      exam={exam}
      attempt={attempt}
      sections={sections}
      activeSection={activeSection}
      mondaiGroups={mondaiGroups}
      initialAnswers={initialAnswers}
      serverNowIso={new Date().toISOString()}
    />
  );
}
