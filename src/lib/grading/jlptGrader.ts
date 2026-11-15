import { createAdminClient } from "@/utils/supabase/admin";

export interface GradingResult {
  section_scores: Record<string, number>;
  total_score: number;
  passed: boolean;
}

interface SectionRow {
  id: string;
  section_number: number;
  section_code: string;
}

interface MondaiRow {
  id: string;
  section_id: string;
}

interface QuestionKeyRow {
  id: string;
  mondai_group_id: string;
  points: number;
  correct_option: number;
}

interface AnswerRow {
  id: string;
  question_id: string;
  selected_option: number | null;
  is_flagged: boolean;
}

export async function evaluateAttempt(
  attemptId: string,
  examId: string
): Promise<GradingResult> {
  const admin = createAdminClient();

  const [
    { data: examData, error: examErr },
    { data: sectionsData, error: secErr },
    { data: answersData, error: ansErr },
  ] = await Promise.all([
    admin
      .from("exams")
      .select("id, total_score_required, max_total_score, sectional_minimums")
      .eq("id", examId)
      .single(),
    admin
      .from("exam_sections")
      .select("id, section_number, section_code")
      .eq("exam_id", examId)
      .order("section_number", { ascending: true }),
    admin
      .from("user_answers")
      .select("id, question_id, selected_option, is_flagged")
      .eq("attempt_id", attemptId),
  ]);

  if (examErr || !examData) {
    throw new Error(examErr?.message || "Exam metadata not found for grading.");
  }
  if (secErr || !sectionsData) {
    throw new Error(secErr?.message || "Exam sections not found for grading.");
  }
  if (ansErr) {
    throw new Error(ansErr.message);
  }

  const sections = sectionsData as SectionRow[];
  const sectionIds = sections.map((s) => s.id);

  const { data: mondaiData, error: mgErr } = await admin
    .from("mondai_groups")
    .select("id, section_id")
    .in("section_id", sectionIds);

  if (mgErr || !mondaiData) {
    throw new Error(mgErr?.message || "Mondai groups not found for grading.");
  }

  const mondaiGroups = mondaiData as MondaiRow[];
  const mondaiIds = mondaiGroups.map((m) => m.id);
  const mondaiToSection = new Map<string, string>();
  for (const mg of mondaiGroups) {
    mondaiToSection.set(mg.id, mg.section_id);
  }

  const { data: questionsData, error: qErr } = await admin
    .from("questions")
    .select("id, mondai_group_id, points, correct_option")
    .in("mondai_group_id", mondaiIds);

  if (qErr || !questionsData) {
    throw new Error(qErr?.message || "Question keys not found for grading.");
  }

  const questions = questionsData as QuestionKeyRow[];
  const existingAnswers = (answersData as AnswerRow[]) ?? [];
  const answerByQuestionId = new Map<string, AnswerRow>();
  for (const a of existingAnswers) {
    answerByQuestionId.set(a.question_id, a);
  }

  // Track raw earned & max points per section_id
  const rawEarnedBySectionId = new Map<string, number>();
  const rawMaxBySectionId = new Map<string, number>();
  for (const sec of sections) {
    rawEarnedBySectionId.set(sec.id, 0);
    rawMaxBySectionId.set(sec.id, 0);
  }

  const nowIso = new Date().toISOString();
  const answerUpserts: {
    attempt_id: string;
    question_id: string;
    selected_option: number | null;
    is_flagged: boolean;
    is_correct: boolean;
    updated_at: string;
  }[] = [];

  for (const q of questions) {
    const secId = mondaiToSection.get(q.mondai_group_id);
    if (!secId) continue;

    const existing = answerByQuestionId.get(q.id);
    const selectedOption = existing?.selected_option ?? null;
    const isCorrect =
      selectedOption !== null && selectedOption === q.correct_option;

    rawMaxBySectionId.set(
      secId,
      (rawMaxBySectionId.get(secId) ?? 0) + q.points
    );

    if (isCorrect) {
      rawEarnedBySectionId.set(
        secId,
        (rawEarnedBySectionId.get(secId) ?? 0) + q.points
      );
    }

    answerUpserts.push({
      attempt_id: attemptId,
      question_id: q.id,
      selected_option: selectedOption,
      is_flagged: existing?.is_flagged ?? false,
      is_correct: isCorrect,
      updated_at: nowIso,
    });
  }

  // Batch upsert is_correct onto user_answers
  if (answerUpserts.length > 0) {
    const { error: upsertErr } = await admin
      .from("user_answers")
      .upsert(answerUpserts, { onConflict: "attempt_id,question_id" });

    if (upsertErr) {
      throw new Error(`Failed to save graded answers: ${upsertErr.message}`);
    }
  }

  // Scale each section proportionally to max_total_score / section_count (e.g. 60 pts each for 180 total)
  const maxTotalScore: number = examData.max_total_score ?? 180;
  const perSectionMax =
    sections.length > 0 ? maxTotalScore / sections.length : 60;

  const sectionScores: Record<string, number> = {};
  let totalScore = 0;

  for (const sec of sections) {
    const earned = rawEarnedBySectionId.get(sec.id) ?? 0;
    const maxRaw = rawMaxBySectionId.get(sec.id) ?? 0;
    const scaled =
      maxRaw > 0 ? Math.round((earned / maxRaw) * perSectionMax) : 0;

    sectionScores[sec.section_code] = scaled;
    totalScore += scaled;
  }

  // Official JLPT Sectional Minimum Checks
  // N5/N4 combine VOCAB + GRAMMAR_READING against language_knowledge_and_reading;
  // N3/N2/N1 may define either combined or individual sectional minimums.
  const minimums =
    (examData.sectional_minimums as Record<string, number>) || {};

  const vocabScore = sectionScores["VOCAB"] ?? 0;
  const grammarReadingScore = sectionScores["GRAMMAR_READING"] ?? 0;
  const listeningScore = sectionScores["LISTENING"] ?? 0;
  const combinedLangReadingScore = vocabScore + grammarReadingScore;

  sectionScores["language_knowledge_and_reading"] = combinedLangReadingScore;
  sectionScores["listening"] = listeningScore;

  let allSectionalMinimumsMet = true;

  for (const [minKey, minRequired] of Object.entries(minimums)) {
    const normalizedKey = minKey.toLowerCase();
    let candidateScore = 0;

    if (normalizedKey === "language_knowledge_and_reading") {
      candidateScore = combinedLangReadingScore;
    } else if (normalizedKey === "listening") {
      candidateScore = listeningScore;
    } else if (normalizedKey === "vocab" || normalizedKey === "vocabulary") {
      candidateScore = vocabScore;
    } else if (normalizedKey === "grammar_reading") {
      candidateScore = grammarReadingScore;
    } else if (minKey in sectionScores) {
      candidateScore = sectionScores[minKey];
    }

    if (candidateScore < Number(minRequired)) {
      allSectionalMinimumsMet = false;
      break;
    }
  }

  const totalScoreRequired = Number(examData.total_score_required ?? 0);
  const passed = totalScore >= totalScoreRequired && allSectionalMinimumsMet;

  return {
    section_scores: sectionScores,
    total_score: totalScore,
    passed,
  };
}
