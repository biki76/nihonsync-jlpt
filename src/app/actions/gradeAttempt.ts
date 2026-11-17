"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { evaluateAttempt, type GradingResult } from "@/lib/grading/jlptGrader";
import { isValidUuid } from "@/lib/validation";

export async function gradeAndCompleteAttempt(
  attemptId: string
): Promise<GradingResult> {
  if (!isValidUuid(attemptId)) {
    throw new Error("Invalid attempt identifier.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized: User must be logged in to grade attempt.");
  }

  const admin = createAdminClient();

  const { data: attempt, error: attemptErr } = await admin
    .from("user_attempts")
    .select("id, user_id, exam_id, status, section_scores, total_score, passed")
    .eq("id", attemptId)
    .single();

  if (attemptErr || !attempt) {
    throw new Error("Attempt not found.");
  }

  if (attempt.user_id !== user.id) {
    throw new Error("Forbidden: Attempt does not belong to current user.");
  }

  if (
    attempt.status === "completed" &&
    attempt.total_score !== null &&
    attempt.passed !== null &&
    attempt.section_scores !== null
  ) {
    return {
      section_scores: attempt.section_scores as Record<string, number>,
      total_score: attempt.total_score as number,
      passed: attempt.passed as boolean,
    };
  }

  const result = await evaluateAttempt(attempt.id, attempt.exam_id);

  // Atomic conditional completion prevents concurrent double-write races
  const { data: updatedRows, error: updateErr } = await admin
    .from("user_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      section_scores: result.section_scores,
      total_score: result.total_score,
      passed: result.passed,
    })
    .eq("id", attempt.id)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .select("section_scores, total_score, passed");

  if (updateErr) {
    throw new Error(`Failed to finalize attempt scores: ${updateErr.message}`);
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { data: alreadyCompleted } = await admin
      .from("user_attempts")
      .select("section_scores, total_score, passed")
      .eq("id", attempt.id)
      .single();

    if (
      alreadyCompleted &&
      alreadyCompleted.total_score !== null &&
      alreadyCompleted.section_scores !== null
    ) {
      return {
        section_scores: alreadyCompleted.section_scores as Record<string, number>,
        total_score: alreadyCompleted.total_score,
        passed: Boolean(alreadyCompleted.passed),
      };
    }
  }

  return result;
}
