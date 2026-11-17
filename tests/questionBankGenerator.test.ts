import { describe, expect, it } from "vitest";
import { generateAllLevels20Sets } from "../scripts/generate_jlpt_bank.mjs";

interface GeneratedQuestion {
  question_number: number;
  prompt_html: string;
  options: Array<{ index: number; text: string }>;
  correct_option: number;
  correct_sequence: number[] | null;
  points: number;
  audio_url: string | null;
  image_url: string | null;
  transcript_ja: string | null;
  explanation: Record<string, string>;
}

interface GeneratedMondaiGroup {
  mondai_number: number;
  question_type: string;
  instruction_ja: string;
  passage_html: string | null;
  questions: GeneratedQuestion[];
}

interface GeneratedSection {
  section_number: number;
  section_code: string;
  section_title_ja: string;
  section_title_en: string;
  time_limit_minutes: number;
  max_score: number;
  mondai_groups: GeneratedMondaiGroup[];
}

interface GeneratedExam {
  exam_metadata: {
    exam_code: string;
    level: string;
    test_number: number;
    title: string;
    is_premium: boolean;
    total_time_minutes: number;
    total_score_required: number;
    max_total_score: number;
    sectional_minimums: Record<string, number>;
    is_published: boolean;
  };
  sections: GeneratedSection[];
}

const REQUIRED_LANGS = ["en", "bn", "hi", "id", "th", "vi", "zh", "ko"];

describe("100-Exam JLPT Question Bank Blueprint (20 sets x 5 levels)", () => {
  const allExams = generateAllLevels20Sets() as GeneratedExam[];

  it("generates exactly 100 exams (20 per level across N5–N1)", () => {
    expect(allExams).toHaveLength(100);
    for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
      const levelExams = allExams.filter((e) => e.exam_metadata.level === level);
      expect(levelExams).toHaveLength(20);
      expect(levelExams.filter((e) => !e.exam_metadata.is_premium)).toHaveLength(2);
      expect(levelExams.filter((e) => e.exam_metadata.is_premium)).toHaveLength(18);
    }
  });

  it("enforces the exact 67-question blueprint (21 Vocab + 24 Grammar/Reading + 22 Listening) with 8-language explanations", () => {
    for (const exam of allExams) {
      expect(exam.sections).toHaveLength(3);
      const counts = exam.sections.map((s) =>
        s.mondai_groups.reduce(
          (sum: number, mg: GeneratedMondaiGroup) => sum + mg.questions.length,
          0
        )
      );
      expect(counts).toEqual([21, 24, 22]);

      for (const sec of exam.sections) {
        for (const mg of sec.mondai_groups) {
          for (const q of mg.questions) {
            expect(q.options).toHaveLength(4);
            expect(q.correct_option).toBeGreaterThanOrEqual(1);
            expect(q.correct_option).toBeLessThanOrEqual(4);

            if (mg.question_type === "sentence_grammar_2_star") {
              expect(q.correct_sequence).toHaveLength(4);
            }

            if (sec.section_code === "LISTENING") {
              expect(typeof q.transcript_ja).toBe("string");
              expect(q.transcript_ja!.length).toBeGreaterThan(5);
            }

            for (const lang of REQUIRED_LANGS) {
              expect(typeof q.explanation[lang]).toBe("string");
              expect(q.explanation[lang].length).toBeGreaterThan(2);
            }
          }
        }
      }
    }
  });
});
