import type { Exam, JlptLevel, SeedQuestion } from "@/types/jlpt";

interface LevelSpec {
  level: JlptLevel;
  totalTime: number;
  passMark: number;
  maxScore: number;
  sectionalMinimums: Record<string, number>;
  sections: {
    vocabMinutes: number;
    grammarReadingMinutes: number;
    listeningMinutes: number;
  };
}

export const JLPT_LEVEL_SPECS: Record<JlptLevel, LevelSpec> = {
  N5: {
    level: "N5",
    totalTime: 90,
    passMark: 80,
    maxScore: 180,
    sectionalMinimums: { language_knowledge_and_reading: 38, listening: 19 },
    sections: { vocabMinutes: 20, grammarReadingMinutes: 40, listeningMinutes: 30 },
  },
  N4: {
    level: "N4",
    totalTime: 115,
    passMark: 90,
    maxScore: 180,
    sectionalMinimums: { language_knowledge_and_reading: 38, listening: 19 },
    sections: { vocabMinutes: 25, grammarReadingMinutes: 55, listeningMinutes: 35 },
  },
  N3: {
    level: "N3",
    totalTime: 140,
    passMark: 95,
    maxScore: 180,
    sectionalMinimums: {
      language_knowledge: 19,
      reading: 19,
      listening: 19,
    },
    sections: { vocabMinutes: 30, grammarReadingMinutes: 70, listeningMinutes: 40 },
  },
  N2: {
    level: "N2",
    totalTime: 155,
    passMark: 90,
    maxScore: 180,
    sectionalMinimums: {
      language_knowledge: 19,
      reading: 19,
      listening: 19,
    },
    sections: { vocabMinutes: 35, grammarReadingMinutes: 70, listeningMinutes: 50 },
  },
  N1: {
    level: "N1",
    totalTime: 170,
    passMark: 100,
    maxScore: 180,
    sectionalMinimums: {
      language_knowledge: 19,
      reading: 19,
      listening: 19,
    },
    sections: { vocabMinutes: 40, grammarReadingMinutes: 70, listeningMinutes: 60 },
  },
};

const LEVELS_ORDER: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export const SEED_EXAMS: Exam[] = LEVELS_ORDER.flatMap((level) => {
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
      created_at: "2026-01-01T00:00:00.000Z",
    };
  });
});

export const SAMPLE_SEED_QUESTIONS: SeedQuestion[] = [
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
  {
    id: "q-n3-read-01",
    level: "N3",
    section_code: "GRAMMAR_READING",
    mondai_number: 3,
    question_type: "reading_short_passage",
    instruction_ja: "<ruby>次<rt>つぎ</rt></ruby>の<ruby>文章<rt>ぶんしょう</rt></ruby>を<ruby>読<rt>よ</rt></ruby>んで、<ruby>質問<rt>しつもん</rt></ruby>に<ruby>答<rt>こた</rt></ruby>えなさい。",
    passage_html: "<p><ruby>最近<rt>さいきん</rt></ruby>は<ruby>便利<rt>べんり</rt></ruby>なアプリが<ruby>増<rt>ふ</rt></ruby>えたが、<ruby>紙<rt>かみ</rt></ruby>の<ruby>手帳<rt>てちょう</rt></ruby>を<ruby>使<rt>つか</rt></ruby>い<ruby>続<rt>つづ</rt></ruby>ける<ruby>人<rt>ひと</rt></ruby>も<ruby>少<rt>すく</rt></ruby>なくない。<ruby>自分<rt>じぶん</rt></ruby>の<ruby>手<rt>て</rt></ruby>で<ruby>書<rt>か</rt></ruby>くことで<ruby>予定<rt>よてい</rt></ruby>が<ruby>記憶<rt>きおく</rt></ruby>に<ruby>残<rt>のこ</rt></ruby>りやすいからだ。</p>",
    question_number: 3,
    prompt_html: "<ruby>紙<rt>かみ</rt></ruby>の<ruby>手帳<rt>てちょう</rt></ruby>を<ruby>使<rt>つか</rt></ruby>う<ruby>理由<rt>りゆう</rt></ruby>は何ですか。",
    options: [
      { index: 1, text: "アプリより<ruby>安<rt>やす</rt></ruby>いから" },
      { index: 2, text: "<ruby>手<rt>て</rt></ruby>で<ruby>書<rt>か</rt></ruby>くと<ruby>予定<rt>よてい</rt></ruby>を<ruby>覚<rt>おぼ</rt></ruby>えやすいから" },
      { index: 3, text: "スマホを<ruby>持<rt>も</rt></ruby>っていないから" },
      { index: 4, text: "<ruby>仕事<rt>しごと</rt></ruby>で<ruby>禁止<rt>きんし</rt></ruby>されているから" },
    ],
    correct_option: 2,
    points: 3,
    explanation: {
      en: "The passage states '自分の手で書くことで予定が記憶に残りやすいからだ' — writing by hand makes schedules easier to remember.",
      bn: "অনুচ্ছেদে বলা হয়েছে হাতে লিখলে সময়সূচি সহজে মনে থাকে (記憶に残りやすい), তাই ২ নম্বর উত্তরটি সঠিক।",
      hi: "गद्यांश के अनुसार हाथ से लिखने पर योजनाएँ आसानी से याद रहती हैं (記憶に残りやすい), इसलिए विकल्प 2 सही है।",
      id: "Teks menjelaskan bahwa menulis dengan tangan membuat jadwal lebih mudah diingat (記憶に残りやすい).",
      th: "บทความระบุว่าการเขียนด้วยมือช่วยให้จำกำหนดการได้ง่ายขึ้น (記憶に残りやすい) ดังนั้นข้อ 2 จึงถูกต้อง",
      vi: "Đoạn văn nêu rõ viết bằng tay giúp dễ ghi nhớ lịch trình hơn (記憶に残りやすい), nên đáp án 2 đúng.",
      zh: "文中明确提到「用自己的手书写更容易记住日程」（記憶に残りやすい），因此选项2正确。",
      ko: "지문에서 직접 손으로 쓰면 일정이 기억에 남기 쉽다(記憶に残りやすい)고 했으므로 2번이 정답입니다.",
    },
  },
  {
    id: "q-n2-vocab-01",
    level: "N2",
    section_code: "VOCAB",
    mondai_number: 1,
    question_type: "context_vocab",
    instruction_ja: "（　　　）に<ruby>入<rt>い</rt></ruby>れるのに最もよいものを、1・2・3・4から一つえらびなさい。",
    passage_html: null,
    question_number: 4,
    prompt_html: "<ruby>新製品<rt>しんせいひん</rt></ruby>の<ruby>開発<rt>かいはつ</rt></ruby>は、<ruby>予算<rt>よさん</rt></ruby>の（　　　）で<ruby>一時<rt>いちじ</rt></ruby><ruby>中止<rt>ちゅうし</rt></ruby>になった。",
    options: [
      { index: 1, text: "<ruby>都合<rt>つごう</rt></ruby>" },
      { index: 2, text: "<ruby>機嫌<rt>きげん</rt></ruby>" },
      { index: 3, text: "<ruby>様子<rt>ようす</rt></ruby>" },
      { index: 4, text: "<ruby>調子<rt>ちょうし</rt></ruby>" },
    ],
    correct_option: 1,
    points: 1,
    explanation: {
      en: "「予算の都合で」(due to budget circumstances/constraints) is a standard N2 business collocation.",
      bn: "「予算の都合で」 (বাজেট সংক্রান্ত কারণে) একটি প্রচলিত N2 ব্যবসায়িক অভিব্যক্তি।",
      hi: "「予算の都合で」 (बजट की परिस्थितियों के कारण) एक मानक N2 व्यावसायिक वाक्यांश है।",
      id: "「予算の都合で」 (karena alasan/keterbatasan anggaran) adalah kolokasi bisnis standar level N2.",
      th: "「予算の都合で」 (เนื่องจากเหตุผลด้านงบประมาณ) เป็นสำนวนธุรกิจมาตรฐานระดับ N2",
      vi: "「予算の都合で」 (do điều kiện/lý do ngân sách) là cụm từ cố định thường gặp trong N2.",
      zh: "「予算の都合で」（由于预算方面的原因）是N2商务日语中的固定搭配。",
      ko: "「予算の都合で」(예산 사정으로)는 N2 비즈니스에서 자주 쓰이는 관용 표현입니다.",
    },
  },
  {
    id: "q-n1-list-01",
    level: "N1",
    section_code: "LISTENING",
    mondai_number: 4,
    question_type: "quick_response",
    instruction_ja: "<ruby>文<rt>ぶん</rt></ruby>を<ruby>聞<rt>き</rt></ruby>いて、1から3の<ruby>中<rt>なか</rt></ruby>から最もよいものを一つえらびなさい。",
    passage_html: null,
    question_number: 5,
    prompt_html: "（<ruby>音声<rt>おんせい</rt></ruby>のみ・<ruby>即時応答<rt>そくじおうとう</rt></ruby>）",
    options: [
      { index: 1, text: "1（<ruby>恐<rt>おそ</rt></ruby>れ<ruby>入<rt>い</rt></ruby>ります。<ruby>早速<rt>さっそく</rt></ruby><ruby>拝見<rt>はいけん</rt></ruby>します。）" },
      { index: 2, text: "2（はい、<ruby>私<rt>わたし</rt></ruby>が<ruby>伺<rt>うかが</rt></ruby>うことになっております。）" },
      { index: 3, text: "3（いいえ、<ruby>お構<rt>かま</rt></ruby>いなく。）" },
    ],
    correct_option: 1,
    points: 2,
    transcript_ja: "女：課長、先ほどご依頼のあった企画書、机の上に置いておきました。\n男：1 恐れ入ります。早速拝見します。\n2 はい、私が伺うことになっております。\n3 いいえ、お構いなく。",
    explanation: {
      en: "When a subordinate reports placing a requested proposal on the manager's desk, '恐れ入ります。早速拝見します' (Thank you, I'll look at it right away) is the natural polite response.",
      bn: "অধস্তন কর্মী প্রস্তাবনাটি টেবিলে রাখার কথা জানালে '恐れ入ります。早速拝見します' (ধন্যবাদ, আমি এখনই দেখছি) হলো সঠিক ভদ্র উত্তর।",
      hi: "जब अधीनस्थ प्रस्ताव मेज़ पर रखने की सूचना देता है, तो '恐れ入ります。早速拝見します' (धन्यवाद, मैं अभी देखता हूँ) सबसे उपयुक्त विनम्र उत्तर है।",
      id: "Saat bawahan melaporkan telah meletakkan proposal di meja, '恐れ入ります。早速拝見します' (Terima kasih, akan segera saya periksa) adalah respons sopan yang tepat.",
      th: "เมื่อลูกน้องรายงานว่าวางเอกสารเสนอโครงการไว้บนโต๊ะแล้ว คำตอบสุภาพที่เหมาะสมคือ '恐れ入ります。早速拝見します' (ขอบคุณ จะรีบดูเดี๋ยวนี้)",
      vi: "Khi cấp dưới báo đã đặt bản kế hoạch lên bàn, câu đáp lịch sự tự nhiên nhất là '恐れ入ります。早速拝見します' (Cảm ơn, tôi sẽ xem ngay).",
      zh: "下属汇报已将企划书放在桌上时，「恐れ入ります。早速拝見します」（辛苦了，我马上过目）是最得体的回应。",
      ko: "부하 직원이 기획서를 책상 위에 두었다고 보고할 때 '恐れ入ります。早速拝見します'(수고했네. 바로 살펴보겠네)가 가장 자연스러운 응답입니다.",
    },
  },
];
