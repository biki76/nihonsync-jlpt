// Universal ES Module wrapper for Node/Python/CLI seeders & Next.js tooling
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "bn", label: "Bangla", native: "বাংলা" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "id", label: "Indonesian", native: "Indonesia" },
  { code: "th", label: "Thai", native: "ไทย" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ko", label: "Korean", native: "한국어" },
];

export const JLPT_LEVEL_SPECS = {
  N5: { totalTime: 90, passMark: 80, maxScore: 180, sectionalMinimums: { language_knowledge_and_reading: 38, listening: 19 } },
  N4: { totalTime: 115, passMark: 90, maxScore: 180, sectionalMinimums: { language_knowledge_and_reading: 38, listening: 19 } },
  N3: { totalTime: 140, passMark: 95, maxScore: 180, sectionalMinimums: { language_knowledge: 19, reading: 19, listening: 19 } },
  N2: { totalTime: 155, passMark: 90, maxScore: 180, sectionalMinimums: { language_knowledge: 19, reading: 19, listening: 19 } },
  N1: { totalTime: 170, passMark: 100, maxScore: 180, sectionalMinimums: { language_knowledge: 19, reading: 19, listening: 19 } },
};

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export const SEED_EXAMS = LEVELS.flatMap((level) => {
  const spec = JLPT_LEVEL_SPECS[level];
  return Array.from({ length: 20 }, (_, idx) => {
    const testNumber = idx + 1;
    const padded = String(testNumber).padStart(2, "0");
    return {
      id: `seed-${level.toLowerCase()}-mock-${padded}`,
      exam_code: `JLPT-${level}-MOCK-${padded}`,
      level,
      test_number: testNumber,
      title: `JLPT ${level} Full Mock Exam #${padded}`,
      is_premium: testNumber > 2,
      total_time_minutes: spec.totalTime,
      total_score_required: spec.passMark,
      max_total_score: spec.maxScore,
      sectional_minimums: spec.sectionalMinimums,
      is_published: true,
    };
  });
});

export const SAMPLE_SEED_QUESTIONS = [
  {
    id: "q-n5-vocab-01",
    level: "N5",
    section_code: "VOCAB",
    mondai_number: 1,
    question_type: "kanji_reading",
    instruction_ja: "<u>　　　</u>の<ruby>言葉<rt>ことば</rt></ruby>の<ruby>読<rt>よ</rt></ruby>み<ruby>方<rt>かた</rt></ruby>として最もよいものを、1・2・3・4から一つえらびなさい。",
    passage_html: null,
    question_number: 1,
    prompt_html: "<ruby>毎日<rt>まいにち</rt></ruby> <u><ruby>電車<rt>でんしゃ</rt></ruby></u> で <ruby>学校<rt>がっこう</rt></ruby> に <ruby>行<rt>い</rt></ruby>きます。",
    options: [
      { index: 1, text: "でんしゃ" },
      { index: 2, text: "てんしゃ" },
      { index: 3, text: "でんじゃ" },
      { index: 4, text: "てんじゃ" },
    ],
    correct_option: 1,
    points: 1,
    explanation: {
      en: "電車 is read 'densha' (train). Note the voiced 'de' at the start and unvoiced 'sha' at the end.",
      bn: "電車 (দেনশা) অর্থ ট্রেন। শুরুতে 'দে' এবং শেষে 'শা' উচ্চারিত হয়।",
      hi: "電車 (देन्शा) का अर्थ ट्रेन है। शुरुआत में 'दे' और अंत में 'शा' का उच्चारण होता है।",
      id: "電車 dibaca 'densha' (kereta listrik). Perhatikan bunyi 'de' di awal dan 'sha' di akhir.",
      th: "電車 อ่านว่า 'เด็นฉะ' (รถไฟ) สังเกตเสียงขุ่น 'เดะ' ด้านหน้าและเสียงใส 'ฉะ' ด้านหลัง",
      vi: "電車 đọc là 'densha' (tàu điện). Lưu ý âm đục 'de' ở đầu và âm 'sha' ở cuối.",
      zh: "電車读作「でんしゃ」（电车）。注意词首为浊音「で」，词尾为清音「しゃ」。",
      ko: "電車는 'でんしゃ'(전철)라고 읽습니다. 앞 글자는 탁음 'で', 뒷 글자는 'しゃ'입니다.",
    },
  },
  {
    id: "q-n4-gram-01",
    level: "N4",
    section_code: "GRAMMAR_READING",
    mondai_number: 2,
    question_type: "sentence_grammar_2_star",
    instruction_ja: "<u>　★　</u>に入る最もよいものを、1・2・3・4から一つえらびなさい。",
    passage_html: null,
    question_number: 2,
    prompt_html: "<ruby>日本<rt>にほん</rt></ruby> に ＿＿＿ ＿＿＿ <u>　★　</u> ＿＿＿ <ruby>買<rt>か</rt></ruby>いました。",
    options: [
      { index: 1, text: "カメラを" },
      { index: 2, text: "<ruby>来<rt>き</rt></ruby>た" },
      { index: 3, text: "<ruby>新<rt>あたら</rt></ruby>しい" },
      { index: 4, text: "ときに" },
    ],
    correct_option: 3,
    correct_sequence: [2, 4, 3, 1],
    points: 2,
    explanation: {
      en: "Full sentence: 日本に来たときに新しいカメラを買いました (2 → 4 → 3 → 1). Option 3 (新しい) sits in the ★ slot.",
      bn: "পূর্ণ বাক্য: 日本に来たときに新しいカメラを買いました (২ → ৪ → ৩ → ১)। ★ স্থানে ৩ নম্বর (新しい) বসবে।",
      hi: "पूरा वाक्य: 日本に来たときに新しいカメラを買いました (2 → 4 → 3 → 1)। ★ स्थान पर विकल्प 3 (新しい) आएगा।",
      id: "Kalimat lengkap: 日本に来たときに新しいカメラを買いました (2 → 4 → 3 → 1). Posisi ★ diisi oleh pilihan 3 (新しい).",
      th: "ประโยคเต็ม: 日本に来たときに新しいカメラを買いました (2 → 4 → 3 → 1) ตำแหน่ง ★ คือข้อ 3 (新しい)",
      vi: "Câu hoàn chỉnh: 日本に来たときに新しいカメラを買いました (2 → 4 → 3 → 1). Vị trí ★ là đáp án 3 (新しい).",
      zh: "完整句子：日本に来たときに新しいカメラを買いました（2 → 4 → 3 → 1）。★位置应填入选项3（新しい）。",
      ko: "완성 문장: 日本に来たときに新しいカメラを買いました (2 → 4 → 3 → 1). ★ 자리는 3번(新しい)입니다.",
    },
  },
];

export default { SUPPORTED_LANGUAGES, JLPT_LEVEL_SPECS, SEED_EXAMS, SAMPLE_SEED_QUESTIONS };
