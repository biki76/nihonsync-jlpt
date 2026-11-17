import fs from "fs";
import path from "path";
import { N5_BANK } from "./banks/n5.mjs";
import { N4_BANK } from "./banks/n4.mjs";
import { N3_BANK } from "./banks/n3.mjs";
import { N2_BANK } from "./banks/n2.mjs";
import { N1_BANK } from "./banks/n1.mjs";

const BANKS = {
  N5: N5_BANK,
  N4: N4_BANK,
  N3: N3_BANK,
  N2: N2_BANK,
  N1: N1_BANK,
};

export const LEVEL_CONFIGS = {
  N5: {
    total_time_minutes: 90,
    total_score_required: 80,
    max_total_score: 180,
    sectional_minimums: { language_knowledge_and_reading: 38, listening: 19 },
    sections: [
      { section_number: 1, section_code: "VOCAB", section_title_ja: "言語知識（文字・語彙）", section_title_en: "Language Knowledge: Vocabulary", time_limit_minutes: 20, max_score: 60 },
      { section_number: 2, section_code: "GRAMMAR_READING", section_title_ja: "言語知識（文法）・読解", section_title_en: "Language Knowledge: Grammar & Reading", time_limit_minutes: 40, max_score: 60 },
      { section_number: 3, section_code: "LISTENING", section_title_ja: "聴解", section_title_en: "Listening", time_limit_minutes: 30, max_score: 60 },
    ],
  },
  N4: {
    total_time_minutes: 115,
    total_score_required: 90,
    max_total_score: 180,
    sectional_minimums: { language_knowledge_and_reading: 38, listening: 19 },
    sections: [
      { section_number: 1, section_code: "VOCAB", section_title_ja: "言語知識（文字・語彙）", section_title_en: "Language Knowledge: Vocabulary", time_limit_minutes: 25, max_score: 60 },
      { section_number: 2, section_code: "GRAMMAR_READING", section_title_ja: "言語知識（文法）・読解", section_title_en: "Language Knowledge: Grammar & Reading", time_limit_minutes: 55, max_score: 60 },
      { section_number: 3, section_code: "LISTENING", section_title_ja: "聴解", section_title_en: "Listening", time_limit_minutes: 35, max_score: 60 },
    ],
  },
  N3: {
    total_time_minutes: 140,
    total_score_required: 95,
    max_total_score: 180,
    sectional_minimums: { language_knowledge: 19, reading: 19, listening: 19 },
    sections: [
      { section_number: 1, section_code: "VOCAB", section_title_ja: "言語知識（文字・語彙）", section_title_en: "Language Knowledge: Vocabulary", time_limit_minutes: 30, max_score: 60 },
      { section_number: 2, section_code: "GRAMMAR_READING", section_title_ja: "言語知識（文法）・読解", section_title_en: "Language Knowledge: Grammar & Reading", time_limit_minutes: 70, max_score: 60 },
      { section_number: 3, section_code: "LISTENING", section_title_ja: "聴解", section_title_en: "Listening", time_limit_minutes: 40, max_score: 60 },
    ],
  },
  N2: {
    total_time_minutes: 155,
    total_score_required: 90,
    max_total_score: 180,
    sectional_minimums: { language_knowledge: 19, reading: 19, listening: 19 },
    sections: [
      { section_number: 1, section_code: "VOCAB", section_title_ja: "言語知識（文字・語彙）", section_title_en: "Language Knowledge: Vocabulary", time_limit_minutes: 35, max_score: 60 },
      { section_number: 2, section_code: "GRAMMAR_READING", section_title_ja: "言語知識（文法）・読解", section_title_en: "Language Knowledge: Grammar & Reading", time_limit_minutes: 70, max_score: 60 },
      { section_number: 3, section_code: "LISTENING", section_title_ja: "聴解", section_title_en: "Listening", time_limit_minutes: 50, max_score: 60 },
    ],
  },
  N1: {
    total_time_minutes: 170,
    total_score_required: 100,
    max_total_score: 180,
    sectional_minimums: { language_knowledge: 19, reading: 19, listening: 19 },
    sections: [
      { section_number: 1, section_code: "VOCAB", section_title_ja: "言語知識（文字・語彙）", section_title_en: "Language Knowledge: Vocabulary", time_limit_minutes: 40, max_score: 60 },
      { section_number: 2, section_code: "GRAMMAR_READING", section_title_ja: "言語知識（文法）・読解", section_title_en: "Language Knowledge: Grammar & Reading", time_limit_minutes: 70, max_score: 60 },
      { section_number: 3, section_code: "LISTENING", section_title_ja: "聴解", section_title_en: "Listening", time_limit_minutes: 60, max_score: 60 },
    ],
  },
};

function rotateOptions(options, ansOneBased, shift) {
  const n = options.length;
  const offset = ((shift % n) + n) % n;
  const rotated = options.map((_, i) => options[(i + offset) % n]);
  const correctText = options[ansOneBased - 1];
  const newAns = rotated.findIndex((t) => t === correctText) + 1;
  return {
    options: rotated.map((text, idx) => ({ index: idx + 1, text })),
    correct_option: newAns,
  };
}

function pickItem(pool, testNumber, slotIndex) {
  const stride = 7;
  const idx = (testNumber * stride + slotIndex * 3) % pool.length;
  return pool[idx];
}

function buildStandaloneQuestions(pool, startQNum, count, testNumber, points = 1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const qNum = startQNum + i;
    const raw = pickItem(pool, testNumber, i);
    const { options, correct_option } = rotateOptions(
      raw.options,
      raw.ans,
      testNumber + i
    );
    out.push({
      question_number: qNum,
      prompt_html: `<p><span class="mr-1.5 font-bold text-[#E04F33]">[Set ${String(testNumber).padStart(2, "0")}]</span>${raw.stem}</p>`,
      options,
      correct_option,
      correct_sequence: null,
      points,
      audio_url: null,
      image_url: null,
      transcript_ja: null,
      explanation: raw.explanation,
    });
  }
  return out;
}

function buildStarQuestions(pool, startQNum, count, testNumber) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const qNum = startQNum + i;
    const raw = pickItem(pool, testNumber, i);
    out.push({
      question_number: qNum,
      prompt_html: `<p><span class="mr-1.5 font-bold text-[#E04F33]">[Set ${String(testNumber).padStart(2, "0")}]</span>${raw.stem}</p>`,
      options: raw.options.map((text, idx) => ({ index: idx + 1, text })),
      correct_option: raw.ans,
      correct_sequence: raw.seq,
      points: 2,
      audio_url: null,
      image_url: null,
      transcript_ja: null,
      explanation: raw.explanation,
    });
  }
  return out;
}

function buildListeningQuestions(pool, startQNum, count, level, testNumber, mondaiNum) {
  const padded = String(testNumber).padStart(2, "0");
  const out = [];
  for (let i = 0; i < count; i++) {
    const qNum = startQNum + i;
    const raw = pickItem(pool, testNumber + mondaiNum, i);
    const { options, correct_option } = rotateOptions(
      raw.options,
      raw.ans,
      testNumber + mondaiNum + i
    );
    out.push({
      question_number: qNum,
      prompt_html: `<p><span class="mr-1.5 font-bold text-[#E04F33]">[Set ${padded} • M${mondaiNum}]</span>${raw.stem}</p>`,
      options,
      correct_option,
      correct_sequence: null,
      points: 2,
      audio_url: `jlpt/${level.toLowerCase()}/mock${padded}/listening_q${qNum}.mp3`,
      image_url: null,
      transcript_ja: raw.transcript,
      explanation: raw.explanation,
    });
  }
  return out;
}

/**
 * Generates a complete 67-question mock exam matching JLPT_N5_Full_Mock_Exam.pdf:
 * - Section 1 (VOCAB): 21 questions (Q1..Q21) across Mondai 1..5
 * - Section 2 (GRAMMAR_READING): 24 questions (Q22..Q45) across Mondai 1..6
 * - Section 3 (LISTENING): 22 questions (Q46..Q67) across Mondai 1..4
 */
export function generateMockExamSet(level, testNumber) {
  const bank = BANKS[level];
  const cfg = LEVEL_CONFIGS[level];
  if (!bank || !cfg) {
    throw new Error(`Unsupported JLPT level: ${level}`);
  }

  const padded = String(testNumber).padStart(2, "0");
  const difficultyTier =
    testNumber <= 5
      ? "Standard"
      : testNumber <= 13
      ? "Advanced"
      : "Master Hard";

  const textGrammarGroup = pickItem(bank.text_grammar, testNumber, 0);
  const midReadingGroup = pickItem(bank.reading_mid, testNumber, 0);
  const infoReadingGroup = pickItem(bank.reading_info, testNumber, 0);

  return {
    exam_metadata: {
      exam_code: `JLPT-${level}-MOCK-${padded}`,
      level,
      test_number: testNumber,
      title: `JLPT ${level} Full Simulation #${padded} (${difficultyTier})`,
      is_premium: testNumber > 2,
      total_time_minutes: cfg.total_time_minutes,
      total_score_required: cfg.total_score_required,
      max_total_score: cfg.max_total_score,
      sectional_minimums: cfg.sectional_minimums,
      is_published: true,
    },
    sections: [
      {
        ...cfg.sections[0],
        mondai_groups: [
          {
            mondai_number: 1,
            question_type: "kanji_reading",
            instruction_ja: "問題1　＿＿＿の　ことばの　読み方として　最もよいものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStandaloneQuestions(bank.kanji_reading, 1, 5, testNumber, 1),
          },
          {
            mondai_number: 2,
            question_type: "orthography",
            instruction_ja: "問題2　＿＿＿の　ことばを　漢字で書くとき、最もよいものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStandaloneQuestions(bank.orthography, 6, 4, testNumber, 1),
          },
          {
            mondai_number: 3,
            question_type: "contextually_defined_expressions",
            instruction_ja: "問題3　（　　　）に入れるのに　最もよいものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStandaloneQuestions(bank.contextually_defined_expressions, 10, 5, testNumber, 1),
          },
          {
            mondai_number: 4,
            question_type: "paraphrases",
            instruction_ja: "問題4　＿＿＿の　ことばに　意味が最も近いものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStandaloneQuestions(bank.paraphrases, 15, 4, testNumber, 1),
          },
          {
            mondai_number: 5,
            question_type: "usage",
            instruction_ja: "問題5　つぎの　ことばの使い方として　最もよいものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStandaloneQuestions(bank.usage, 19, 3, testNumber, 2),
          },
        ],
      },
      {
        ...cfg.sections[1],
        mondai_groups: [
          {
            mondai_number: 1,
            question_type: "sentence_grammar_1",
            instruction_ja: "問題1　（　　　）に入れるのに　最もよいものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStandaloneQuestions(bank.sentence_grammar_1, 22, 12, testNumber, 1),
          },
          {
            mondai_number: 2,
            question_type: "sentence_grammar_2_star",
            instruction_ja: "問題2　<u>　★　</u>に入る　最もよいものを、1・2・3・4から　一つえらびなさい。",
            passage_html: null,
            questions: buildStarQuestions(bank.star_questions, 34, 2, testNumber),
          },
          {
            mondai_number: 3,
            question_type: "text_grammar",
            instruction_ja: "問題3　つぎの　文章を読んで、文章全体の内容を考えて、（ 36 ）から（ 38 ）の中に入る最もよいものをえらびなさい。",
            passage_html: textGrammarGroup.passage,
            questions: textGrammarGroup.questions.map((q, idx) => {
              const { options, correct_option } = rotateOptions(q.options, q.ans, testNumber + idx);
              return {
                question_number: 36 + idx,
                prompt_html: `<p>${q.stem}</p>`,
                options,
                correct_option,
                correct_sequence: null,
                points: 2,
                audio_url: null,
                image_url: null,
                transcript_ja: null,
                explanation: q.explanation,
              };
            }),
          },
          {
            mondai_number: 4,
            question_type: "reading_short",
            instruction_ja: "問題4　つぎの（1）から（3）の文章を読んで、質問に答えなさい。",
            passage_html: [0, 1, 2]
              .map((i) => `<div class="mb-4 border-b pb-3"><strong>(${i + 1})</strong> ${pickItem(bank.reading_short, testNumber, i).passage}</div>`)
              .join(""),
            questions: [0, 1, 2].map((i) => {
              const raw = pickItem(bank.reading_short, testNumber, i);
              const { options, correct_option } = rotateOptions(raw.options, raw.ans, testNumber + i);
              return {
                question_number: 39 + i,
                prompt_html: `<p><strong>(${i + 1})</strong> ${raw.stem}</p>`,
                options,
                correct_option,
                correct_sequence: null,
                points: 2,
                audio_url: null,
                image_url: null,
                transcript_ja: null,
                explanation: raw.explanation,
              };
            }),
          },
          {
            mondai_number: 5,
            question_type: "reading_mid",
            instruction_ja: "問題5　つぎの　文章を読んで、質問に答えなさい。",
            passage_html: midReadingGroup.passage,
            questions: midReadingGroup.questions.map((q, idx) => {
              const { options, correct_option } = rotateOptions(q.options, q.ans, testNumber + idx);
              return {
                question_number: 42 + idx,
                prompt_html: `<p>${q.stem}</p>`,
                options,
                correct_option,
                correct_sequence: null,
                points: 3,
                audio_url: null,
                image_url: null,
                transcript_ja: null,
                explanation: q.explanation,
              };
            }),
          },
          {
            mondai_number: 6,
            question_type: "reading_info_retrieval",
            instruction_ja: "問題6　右の　案内を見て、下の質問に答えなさい。",
            passage_html: infoReadingGroup.passage,
            questions: infoReadingGroup.questions.map((q, idx) => {
              const { options, correct_option } = rotateOptions(q.options, q.ans, testNumber + idx);
              return {
                question_number: 44 + idx,
                prompt_html: `<p>${q.stem}</p>`,
                options,
                correct_option,
                correct_sequence: null,
                points: 3,
                audio_url: null,
                image_url: null,
                transcript_ja: null,
                explanation: q.explanation,
              };
            }),
          },
        ],
      },
      {
        ...cfg.sections[2],
        mondai_groups: [
          {
            mondai_number: 1,
            question_type: "task_based_comprehension",
            instruction_ja: "問題1　課題理解：はじめに質問を聞いてください。それから話を聞いて、1から4の中から最もよいものを一つえらびなさい。",
            passage_html: null,
            questions: buildListeningQuestions(bank.listening, 46, 6, level, testNumber, 1),
          },
          {
            mondai_number: 2,
            question_type: "key_points_comprehension",
            instruction_ja: "問題2　ポイント理解：はじめに質問を聞いてください。そのあと用紙を見て、話を聞いて答えなさい。",
            passage_html: null,
            questions: buildListeningQuestions(bank.listening, 52, 6, level, testNumber, 2),
          },
          {
            mondai_number: 3,
            question_type: "verbal_expressions",
            instruction_ja: "問題3　発話表現：絵を見ながら質問を聞いて、1から4の中から最もよいものを一つえらびなさい。",
            passage_html: null,
            questions: buildListeningQuestions(bank.listening, 58, 5, level, testNumber, 3),
          },
          {
            mondai_number: 4,
            question_type: "quick_response",
            instruction_ja: "問題4　即時応答：文を聞いて、1から4の中から最もよいものを一つえらびなさい。",
            passage_html: null,
            questions: buildListeningQuestions(bank.listening, 63, 5, level, testNumber, 4),
          },
        ],
      },
    ],
  };
}

export function generateAllLevels20Sets() {
  const levels = ["N5", "N4", "N3", "N2", "N1"];
  const allExams = [];
  for (const level of levels) {
    for (let testNumber = 1; testNumber <= 20; testNumber++) {
      allExams.push(generateMockExamSet(level, testNumber));
    }
  }
  return allExams;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = path.join(process.cwd(), "data/generated");
  fs.mkdirSync(outDir, { recursive: true });
  const levels = ["N5", "N4", "N3", "N2", "N1"];
  let totalExams = 0;
  let totalQuestions = 0;

  for (const level of levels) {
    const sets = [];
    for (let t = 1; t <= 20; t++) {
      const exam = generateMockExamSet(level, t);
      sets.push(exam);
      totalExams += 1;
      for (const s of exam.sections) {
        for (const mg of s.mondai_groups) {
          totalQuestions += mg.questions.length;
        }
      }
    }
    const outFile = path.join(outDir, `jlpt_${level}_20sets.json`);
    fs.writeFileSync(outFile, JSON.stringify(sets, null, 2));
    console.log(`Generated ${outFile} (${sets.length} sets)`);
  }
  console.log(`DONE: ${totalExams} mock exams (${totalQuestions} total questions) generated.`);
}
