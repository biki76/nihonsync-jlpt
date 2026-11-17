import fs from "fs";
import path from "path";
import { generateMockExamSet } from "./generate_jlpt_bank.mjs";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function postgrestUpsert(table, onConflict, rows) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upsert failed on ${table} (${res.status}): ${errText}`);
  }
  return res.json();
}

async function seedSingleExam(examPayload) {
  const [examRow] = await postgrestUpsert("exams", "level,test_number", [
    examPayload.exam_metadata,
  ]);

  const sectionInputs = examPayload.sections.map((sec) => ({
    exam_id: examRow.id,
    section_number: sec.section_number,
    section_code: sec.section_code,
    section_title_ja: sec.section_title_ja,
    section_title_en: sec.section_title_en,
    time_limit_minutes: sec.time_limit_minutes,
    max_score: sec.max_score,
  }));

  const sectionRows = await postgrestUpsert(
    "exam_sections",
    "exam_id,section_number",
    sectionInputs
  );

  const secIdByNum = new Map(sectionRows.map((s) => [s.section_number, s.id]));

  for (const sec of examPayload.sections) {
    const sectionId = secIdByNum.get(sec.section_number);
    const mgInputs = sec.mondai_groups.map((mg) => ({
      section_id: sectionId,
      mondai_number: mg.mondai_number,
      question_type: mg.question_type,
      instruction_ja: mg.instruction_ja,
      passage_html: mg.passage_html,
    }));

    const mgRows = await postgrestUpsert(
      "mondai_groups",
      "section_id,mondai_number",
      mgInputs
    );
    const mgIdByNum = new Map(mgRows.map((m) => [m.mondai_number, m.id]));

    const questionInputs = [];
    for (const mg of sec.mondai_groups) {
      const mondaiGroupId = mgIdByNum.get(mg.mondai_number);
      for (const q of mg.questions) {
        questionInputs.push({
          mondai_group_id: mondaiGroupId,
          question_number: q.question_number,
          prompt_html: q.prompt_html,
          options: q.options,
          correct_option: q.correct_option,
          correct_sequence: q.correct_sequence,
          points: q.points,
          audio_url: q.audio_url,
          image_url: q.image_url,
          transcript_ja: q.transcript_ja,
          explanation: q.explanation,
        });
      }
    }

    await postgrestUpsert(
      "questions",
      "mondai_group_id,question_number",
      questionInputs
    );
  }
}

async function main() {
  const levelArg = process.argv.find((a) => a.startsWith("--level="));
  const targetLevels = levelArg
    ? [levelArg.split("=")[1].toUpperCase()]
    : ["N5", "N4", "N3", "N2", "N1"];

  let count = 0;
  for (const level of targetLevels) {
    for (let testNum = 1; testNum <= 20; testNum++) {
      const exam = generateMockExamSet(level, testNum);
      await seedSingleExam(exam);
      count += 1;
      process.stdout.write(
        `\rSeeded ${count}/${targetLevels.length * 20}: ${exam.exam_metadata.exam_code} (67 questions)`
      );
    }
  }
  console.log(`\nDONE: Successfully populated ${count} exams (${count * 67} questions) in Supabase!`);
}

main().catch((err) => {
  console.error("\nSEED ERROR:", err.message);
  process.exit(1);
});
