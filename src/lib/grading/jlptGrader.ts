import { createAdminClient } from "@/utils/supabase/admin";

export interface GradingResult {
  section_scores: Record<string, number>;
  total_score: number;
  passed: boolean;
}

export interface SectionGradingInput {
  id: string;
  section_code: string;
  max_score?: number | null;
}

export interface QuestionGradingInput {
  id: string;
  section_id: string;
  points: number;
  correct_option: number;
}

export interface AnswerGradingInput {
  question_id: string;
  selected_option: number | null;
}

/**
 * Pure JLPT scoring calculator supporting both 3-section (60/60/60) and
 * 2-section (120/60) exam configurations plus dual-condition JLPT pass rules.
 */
export function computeJlptScore(params: {
  maxTotalScore: number;
  totalScoreRequired: number;
  sectionalMinimums: Record<string, number>;
  sections: SectionGradingInput[];
  questions: QuestionGradingInput[];
  answers: AnswerGradingInput[];
}): {
  result: GradingResult;
  gradedAnswers: Array<{ question_id: string; is_correct: boolean }>;
} {
  const {
    maxTotalScore,
    totalScoreRequired,
    sectionalMinimums,
    sections,
    questions,
    answers,
  } = params;

  const answerMap = new Map<string, number | null>();
  for (const ans of answers) {
    answerMap.set(ans.question_id, ans.selected_option);
  }

  const rawEarnedBySection = new Map<string, number>();
  const rawMaxBySection = new Map<string, number>();
  for (const sec of sections) {
    rawEarnedBySection.set(sec.id, 0);
    rawMaxBySection.set(sec.id, 0);
  }

  const gradedAnswers: Array<{ question_id: string; is_correct: boolean }> = [];

  for (const q of questions) {
    const selected = answerMap.get(q.id) ?? null;
    const isCorrect = selected !== null && selected === q.correct_option;
    const pts = Number(q.points ?? 1);

    rawMaxBySection.set(q.section_id, (rawMaxBySection.get(q.section_id) ?? 0) + pts);
    if (isCorrect) {
      rawEarnedBySection.set(
        q.section_id,
        (rawEarnedBySection.get(q.section_id) ?? 0) + pts
      );
    }

    gradedAnswers.push({ question_id: q.id, is_correct: isCorrect });
  }

  const explicitSum = sections.reduce((acc, s) => acc + (s.max_score ?? 0), 0);
  const allHaveExplicitMax =
    sections.length > 0 && sections.every((s) => typeof s.max_score === "number" && s.max_score > 0);
  const fallbackSectionMax =
    sections.length > 0 ? maxTotalScore / sections.length : maxTotalScore;

  const sectionScores: Record<string, number> = {};
  let totalScore = 0;

  for (const sec of sections) {
    const earned = rawEarnedBySection.get(sec.id) ?? 0;
    const maxPts = rawMaxBySection.get(sec.id) ?? 0;
    const targetMax = allHaveExplicitMax
      ? (sec.max_score as number)
      : explicitSum > 0 && sec.max_score
      ? sec.max_score
      : fallbackSectionMax;

    const scaled = maxPts > 0 ? Math.round((earned / maxPts) * targetMax) : 0;
    sectionScores[sec.section_code] = scaled;
    totalScore += scaled;
  }

  const vocabScore = sectionScores["VOCAB"] ?? 0;
  const grammarReadingScore =
    sectionScores["GRAMMAR_READING"] ??
    sectionScores["LANGUAGE_KNOWLEDGE_READING"] ??
    0;
  const listeningScore = sectionScores["LISTENING"] ?? 0;
  const combinedLangReading = vocabScore + grammarReadingScore;

  let meetsSectionalMinimums = true;

  for (const [minKey, minRequired] of Object.entries(sectionalMinimums)) {
    const required = Number(minRequired ?? 0);
    if (minKey === "language_knowledge_and_reading") {
      if (combinedLangReading < required) meetsSectionalMinimums = false;
    } else if (minKey === "listening") {
      if (listeningScore < required) meetsSectionalMinimums = false;
    } else if (minKey === "language_knowledge") {
      if (vocabScore < required) meetsSectionalMinimums = false;
    } else if (minKey === "reading") {
      if (grammarReadingScore < required) meetsSectionalMinimums = false;
    } else {
      const upperKey = minKey.toUpperCase();
      if ((sectionScores[upperKey] ?? 0) < required) {
        meetsSectionalMinimums = false;
      }
    }
  }

  const passed = totalScore >= totalScoreRequired && meetsSectionalMinimums;

  return {
    result: {
      section_scores: sectionScores,
      total_score: totalScore,
      passed,
    },
    gradedAnswers,
  };
}

export async function evaluateAttempt(
  attemptId: string,
  examId: string
): Promise<GradingResult> {
  const admin = createAdminClient();

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, total_score_required, max_total_score, sectional_minimums")
    .eq("id", examId)
    .single();

  if (examErr || !exam) {
    throw new Error(`Exam not found for grading: ${examErr?.message ?? examId}`);
  }

  const { data: sections, error: secErr } = await admin
    .from("exam_sections")
    .select("id, section_number, section_code, max_score")
    .eq("exam_id", examId)
    .order("section_number", { ascending: true });

  if (secErr || !sections || sections.length === 0) {
    throw new Error(`Exam sections missing for grading: ${secErr?.message ?? examId}`);
  }

  const sectionIds = sections.map((s) => s.id);
  const { data: mondaiGroups, error: mgErr } = await admin
    .from("mondai_groups")
    .select("id, section_id")
    .in("section_id", sectionIds);

  if (mgErr) {
    throw new Error(`Failed loading mondai groups: ${mgErr.message}`);
  }

  const mgToSectionId = new Map<string, string>();
  for (const mg of mondaiGroups ?? []) {
    mgToSectionId.set(mg.id, mg.section_id);
  }

  const mgIds = Array.from(mgToSectionId.keys());
  const { data: rawQuestions, error: qErr } =
    mgIds.length > 0
      ? await admin
          .from("questions")
          .select("id, mondai_group_id, points, correct_option")
          .in("mondai_group_id", mgIds)
      : { data: [], error: null };

  if (qErr) {
    throw new Error(`Failed loading questions for grading: ${qErr.message}`);
  }

  const { data: userAnswers, error: ansErr } = await admin
    .from("user_answers")
    .select("question_id, selected_option")
    .eq("attempt_id", attemptId);

  if (ansErr) {
    throw new Error(`Failed loading user answers: ${ansErr.message}`);
  }

  const questions: QuestionGradingInput[] = (rawQuestions ?? [])
    .map((q) => ({
      id: q.id,
      section_id: mgToSectionId.get(q.mondai_group_id) ?? "",
      points: Number(q.points ?? 1),
      correct_option: q.correct_option,
    }))
    .filter((q) => Boolean(q.section_id));

  const { result, gradedAnswers } = computeJlptScore({
    maxTotalScore: exam.max_total_score ?? 180,
    totalScoreRequired: exam.total_score_required ?? 80,
    sectionalMinimums: (exam.sectional_minimums as Record<string, number>) ?? {},
    sections,
    questions,
    answers: userAnswers ?? [],
  });

  if (gradedAnswers.length > 0) {
    const upsertRows = gradedAnswers.map((ga) => ({
      attempt_id: attemptId,
      question_id: ga.question_id,
      is_correct: ga.is_correct,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await admin
      .from("user_answers")
      .upsert(upsertRows, { onConflict: "attempt_id,question_id" });

    if (upsertErr) {
      throw new Error(`Failed updating graded answers: ${upsertErr.message}`);
    }
  }

  return result;
}
