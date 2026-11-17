import { describe, expect, it } from "vitest";
import { computeJlptScore } from "@/lib/grading/jlptGrader";

describe("computeJlptScore (NS-007 JLPT Dual-Condition Grading)", () => {
  const sections3 = [
    { id: "s1", section_code: "VOCAB" },
    { id: "s2", section_code: "GRAMMAR_READING" },
    { id: "s3", section_code: "LISTENING" },
  ];

  const questions3 = [
    { id: "q1", section_id: "s1", points: 1, correct_option: 1 },
    { id: "q2", section_id: "s2", points: 1, correct_option: 2 },
    { id: "q3", section_id: "s3", points: 1, correct_option: 3 },
  ];

  it("passes when both total_score >= 80 and sectional minimums are met", () => {
    const { result } = computeJlptScore({
      maxTotalScore: 180,
      totalScoreRequired: 80,
      sectionalMinimums: {
        language_knowledge_and_reading: 38,
        listening: 19,
      },
      sections: sections3,
      questions: questions3,
      answers: [
        { question_id: "q1", selected_option: 1 },
        { question_id: "q2", selected_option: 2 },
        { question_id: "q3", selected_option: 3 },
      ],
    });

    expect(result.total_score).toBe(180);
    expect(result.section_scores).toEqual({
      VOCAB: 60,
      GRAMMAR_READING: 60,
      LISTENING: 60,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when total_score >= 80 (120 pts) but listening is below 19", () => {
    const { result } = computeJlptScore({
      maxTotalScore: 180,
      totalScoreRequired: 80,
      sectionalMinimums: {
        language_knowledge_and_reading: 38,
        listening: 19,
      },
      sections: sections3,
      questions: questions3,
      answers: [
        { question_id: "q1", selected_option: 1 },
        { question_id: "q2", selected_option: 2 },
        { question_id: "q3", selected_option: 4 },
      ],
    });

    expect(result.total_score).toBe(120);
    expect(result.section_scores.LISTENING).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("supports explicit max_score for 2-period JLPT exams (120 + 60)", () => {
    const { result } = computeJlptScore({
      maxTotalScore: 180,
      totalScoreRequired: 90,
      sectionalMinimums: {
        language_knowledge_and_reading: 38,
        listening: 19,
      },
      sections: [
        { id: "s1", section_code: "GRAMMAR_READING", max_score: 120 },
        { id: "s2", section_code: "LISTENING", max_score: 60 },
      ],
      questions: [
        { id: "q1", section_id: "s1", points: 1, correct_option: 1 },
        { id: "q2", section_id: "s2", points: 1, correct_option: 2 },
      ],
      answers: [
        { question_id: "q1", selected_option: 1 },
        { question_id: "q2", selected_option: 1 },
      ],
    });

    expect(result.section_scores).toEqual({
      GRAMMAR_READING: 120,
      LISTENING: 0,
    });
    expect(result.total_score).toBe(120);
    expect(result.passed).toBe(false);
  });
});
