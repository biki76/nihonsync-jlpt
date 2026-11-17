import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("data/sample_jlpt_questions.json Integrity (NS-012)", () => {
  it("parses cleanly and has valid option bounds on all questions", () => {
    const filePath = path.join(process.cwd(), "data/sample_jlpt_questions.json");
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    expect(parsed.exam_metadata.exam_code).toBe("JLPT-N5-MOCK-01");
    expect(Array.isArray(parsed.sections)).toBe(true);

    for (const section of parsed.sections) {
      for (const mg of section.mondai_groups) {
        for (const q of mg.questions) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(q.options.length).toBeLessThanOrEqual(4);
          expect(q.correct_option).toBeGreaterThanOrEqual(1);
          expect(q.correct_option).toBeLessThanOrEqual(q.options.length);
        }
      }
    }
  });
});
