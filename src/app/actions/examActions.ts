"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function startExamAttempt(examId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/exams/${examId}`);
  }

  const [{ data: exam }, { data: profile }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, is_premium, is_published")
      .eq("id", examId)
      .eq("is_published", true)
      .single(),
    supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", user.id)
      .single(),
  ]);

  if (!exam) {
    throw new Error("Exam not found or not published.");
  }

  const isPro = Boolean(profile?.is_pro);
  if (exam.is_premium && !isPro) {
    throw new Error("NihonSync Pro is required to start this mock exam.");
  }

  // Resume existing in-progress attempt if present
  const { data: existingAttempt } = await supabase
    .from("user_attempts")
    .select("id")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAttempt?.id) {
    redirect(`/exams/${examId}/attempt/${existingAttempt.id}`);
  }

  const nowIso = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("user_attempts")
    .insert({
      user_id: user.id,
      exam_id: examId,
      status: "in_progress",
      current_section: 1,
      started_at: nowIso,
      section_started_at: nowIso,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message || "Failed to initialize exam attempt.");
  }

  redirect(`/exams/${examId}/attempt/${created.id}`);
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  selectedOption: number | null,
  isFlagged: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("user_answers").upsert(
    {
      attempt_id: attemptId,
      question_id: questionId,
      selected_option: selectedOption,
      is_flagged: isFlagged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function submitCurrentSection(
  attemptId: string
): Promise<{ nextSection?: number; completed?: boolean; redirectTo?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("user_attempts")
    .select("id, exam_id, status, current_section")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (attemptError || !attempt) {
    throw new Error("Attempt not found.");
  }

  if (attempt.status === "completed") {
    return {
      completed: true,
      redirectTo: `/attempts/${attempt.id}/results`,
    };
  }

  const { data: sections } = await supabase
    .from("exam_sections")
    .select("section_number")
    .eq("exam_id", attempt.exam_id)
    .order("section_number", { ascending: true });

  const totalSections = sections?.length || 3;

  if (attempt.current_section < totalSections) {
    const nextSection = attempt.current_section + 1;
    const { error: updateErr } = await supabase
      .from("user_attempts")
      .update({
        current_section: nextSection,
        section_started_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .eq("user_id", user.id);

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    return { nextSection, completed: false };
  }

  // Final section finished: mark completed (Phase 5 grading engine refines scoring)
  const { error: finishErr } = await supabase
    .from("user_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .eq("user_id", user.id);

  if (finishErr) {
    throw new Error(finishErr.message);
  }

  return {
    completed: true,
    redirectTo: `/attempts/${attempt.id}/results`,
  };
}
