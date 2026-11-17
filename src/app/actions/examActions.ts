"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { gradeAndCompleteAttempt } from "@/app/actions/gradeAttempt";
import { isValidOptionIndex, isValidUuid } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";

const TIMER_GRACE_MS = 5_000;

export async function startExamAttempt(examId: string): Promise<void> {
  if (!isValidUuid(examId)) {
    throw new Error("Invalid exam identifier.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/exams/${examId}`);
  }

  const rate = checkRateLimit(`start:${user.id}`, 10, 60_000);
  if (!rate.allowed) {
    throw new Error("Too many exam start requests. Please wait a moment.");
  }

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, is_premium, is_published")
    .eq("id", examId)
    .eq("is_published", true)
    .single();

  if (examError || !exam) {
    throw new Error("Exam not found or not published.");
  }

  if (exam.is_premium) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro, pro_expires_at")
      .eq("id", user.id)
      .single();

    const isProActive =
      Boolean(profile?.is_pro) &&
      (!profile?.pro_expires_at ||
        Date.parse(profile.pro_expires_at) > Date.now());

    if (!isProActive) {
      redirect(`/exams/${examId}?upgrade=required`);
    }
  }

  const { data: existingAttempts } = await supabase
    .from("user_attempts")
    .select("id")
    .eq("user_id", user.id)
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1);

  if (existingAttempts && existingAttempts.length > 0) {
    redirect(`/exams/${examId}/attempt/${existingAttempts[0].id}`);
  }

  const nowIso = new Date().toISOString();
  const { data: newAttempt, error: insertError } = await supabase
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

  if (insertError || !newAttempt) {
    const { data: raceAttempt } = await supabase
      .from("user_attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("exam_id", examId)
      .eq("status", "in_progress")
      .limit(1)
      .single();

    if (raceAttempt) {
      redirect(`/exams/${examId}/attempt/${raceAttempt.id}`);
    }
    throw new Error(insertError?.message || "Failed to start exam attempt.");
  }

  redirect(`/exams/${examId}/attempt/${newAttempt.id}`);
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  selectedOption: number | null,
  isFlagged: boolean
): Promise<{ ok: boolean; error?: string; expired?: boolean }> {
  if (!isValidUuid(attemptId) || !isValidUuid(questionId)) {
    return { ok: false, error: "Invalid attempt or question identifier." };
  }
  if (!isValidOptionIndex(selectedOption) || typeof isFlagged !== "boolean") {
    return { ok: false, error: "Invalid answer payload." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const rate = checkRateLimit(`save:${user.id}`, 120, 60_000);
  if (!rate.allowed) {
    return { ok: false, error: "Rate limit exceeded. Slow down answer changes." };
  }

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("user_attempts")
    .select("id, user_id, exam_id, status, current_section, section_started_at")
    .eq("id", attemptId)
    .single();

  if (!attempt || attempt.user_id !== user.id) {
    return { ok: false, error: "Attempt not found." };
  }
  if (attempt.status !== "in_progress") {
    return { ok: false, error: "Attempt is already completed." };
  }

  const { data: activeSection } = await admin
    .from("exam_sections")
    .select("id, time_limit_minutes")
    .eq("exam_id", attempt.exam_id)
    .eq("section_number", attempt.current_section)
    .single();

  if (!activeSection) {
    return { ok: false, error: "Active section configuration missing." };
  }

  // Verify question belongs to the active section
  const { data: questionRow } = await admin
    .from("questions")
    .select("id, mondai_groups!inner(section_id)")
    .eq("id", questionId)
    .single();

  const mgRaw: unknown = questionRow?.mondai_groups;
  let questionSectionId: string | undefined;
  if (Array.isArray(mgRaw) && mgRaw.length > 0 && typeof mgRaw[0] === "object" && mgRaw[0] !== null) {
    questionSectionId = (mgRaw[0] as { section_id?: string }).section_id;
  } else if (typeof mgRaw === "object" && mgRaw !== null && "section_id" in mgRaw) {
    questionSectionId = (mgRaw as { section_id?: string }).section_id;
  }

  if (!questionRow || questionSectionId !== activeSection.id) {
    return { ok: false, error: "Question does not belong to the active section." };
  }

  // Enforce server-authoritative section deadline
  const deadlineMs =
    Date.parse(attempt.section_started_at) +
    activeSection.time_limit_minutes * 60_000 +
    TIMER_GRACE_MS;

  if (Date.now() > deadlineMs) {
    return {
      ok: false,
      error: "Section time has expired on the server.",
      expired: true,
    };
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
  attemptId: string,
  expectedSectionNumber?: number
): Promise<{ nextSection?: number; completed?: boolean; redirectTo?: string }> {
  if (!isValidUuid(attemptId)) {
    throw new Error("Invalid attempt identifier.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("user_attempts")
    .select("id, user_id, exam_id, status, current_section")
    .eq("id", attemptId)
    .single();

  if (attemptError || !attempt || attempt.user_id !== user.id) {
    throw new Error("Attempt not found.");
  }

  if (attempt.status === "completed") {
    return {
      completed: true,
      redirectTo: `/attempts/${attempt.id}/results`,
    };
  }

  if (
    typeof expectedSectionNumber === "number" &&
    attempt.current_section !== expectedSectionNumber
  ) {
    return {
      completed: false,
      nextSection: attempt.current_section,
    };
  }

  const { data: sections } = await admin
    .from("exam_sections")
    .select("section_number")
    .eq("exam_id", attempt.exam_id)
    .order("section_number", { ascending: true });

  const totalSections = sections?.length || 3;

  if (attempt.current_section < totalSections) {
    const nextSection = attempt.current_section + 1;
    const { data: transitioned, error: updateError } = await admin
      .from("user_attempts")
      .update({
        current_section: nextSection,
        section_started_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .eq("current_section", attempt.current_section)
      .select("current_section");

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!transitioned || transitioned.length === 0) {
      const { data: latest } = await admin
        .from("user_attempts")
        .select("status, current_section")
        .eq("id", attempt.id)
        .single();

      if (latest?.status === "completed") {
        return {
          completed: true,
          redirectTo: `/attempts/${attempt.id}/results`,
        };
      }
      return {
        completed: false,
        nextSection: latest?.current_section ?? nextSection,
      };
    }

    return { completed: false, nextSection };
  }

  await gradeAndCompleteAttempt(attempt.id);

  return {
    completed: true,
    redirectTo: `/attempts/${attempt.id}/results`,
  };
}
