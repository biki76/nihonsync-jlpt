"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Crown,
  Globe,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  type Exam,
  type JlptLevel,
  type SupportedLang,
  type UserAttempt,
} from "@/types/jlpt";
import { SAMPLE_SEED_QUESTIONS } from "@/data/seedExams";
import { TestCard, type ExamProgressInfo } from "@/components/catalog/TestCard";
import { PaywallModal } from "@/components/catalog/PaywallModal";

interface MockTestCatalogProps {
  exams: Exam[];
  attempts: UserAttempt[];
  initialIsPro: boolean;
  initialLang: SupportedLang;
  userEmail?: string;
}

type CategoryFilter = "all" | "free" | "pro" | "completed";

const LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

const UI_COPY: Record<
  SupportedLang,
  {
    ribbonTitle: string;
    ribbonFreeDesc: string;
    ribbonProDesc: string;
    ribbonCta: string;
    allTests: string;
    freeTests: string;
    proTests: string;
    completedTests: string;
    free: string;
    pro: string;
    completed: string;
    inProgress: string;
    startTest: string;
    resumeTest: string;
    reviewResult: string;
    unlockPro: string;
    progressLabel: string;
    passMark: string;
    mins: string;
    sampleHeader: string;
    furiganaLabel: string;
    modalBadge: string;
    modalTitle: string;
    modalSubtitle: string;
    modalCta: string;
    modalLater: string;
  }
> = {
  en: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "Tests 1–2 Free per level • Upgrade to unlock Tests 3–20 (90+ mock exams)",
    ribbonProDesc: "All 100 JLPT N5–N1 Mock Exams & 8-Language Explanations Unlocked",
    ribbonCta: "Upgrade to Pro",
    allTests: "All Tests",
    freeTests: "Free (Tests 1–2)",
    proTests: "Pro (Tests 3–20)",
    completedTests: "Completed",
    free: "Free",
    pro: "Pro",
    completed: "Completed",
    inProgress: "In Progress",
    startTest: "Start Mock Test",
    resumeTest: "Resume Section",
    reviewResult: "Retake / Review",
    unlockPro: "Unlock with Pro",
    progressLabel: "Section Progress",
    passMark: "Pass",
    mins: "mins",
    sampleHeader: "Interactive Furigana & 8-Language Preview",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "Unlock Full JLPT Mock Series (Tests 3–20)",
    modalSubtitle: "requires NihonSync Pro. Practice with 20 full-length exams per level.",
    modalCta: "Unlock NihonSync Pro Now",
    modalLater: "Continue with Free Tests (1–2)",
  },
  bn: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "প্রতি লেভেলে টেস্ট ১–২ ফ্রি • টেস্ট ৩–২০ আনলক করতে প্রো নিন",
    ribbonProDesc: "সকল ১০০টি JLPT N5–N1 মক টেস্ট ও ৮ ভাষার ব্যাখ্যা আনলক করা আছে",
    ribbonCta: "প্রো আপগ্রেড করুন",
    allTests: "সব টেস্ট",
    freeTests: "ফ্রি (টেস্ট ১–২)",
    proTests: "প্রো (টেস্ট ৩–২০)",
    completedTests: "সম্পন্ন হয়েছে",
    free: "ফ্রি",
    pro: "প্রো",
    completed: "সম্পন্ন",
    inProgress: "চলমান",
    startTest: "মক টেস্ট শুরু করুন",
    resumeTest: "চালিয়ে যান",
    reviewResult: "ফলাফল ও রিভিউ",
    unlockPro: "প্রো দিয়ে আনলক করুন",
    progressLabel: "সেকশন অগ্রগতি",
    passMark: "পাস নম্বর",
    mins: "মিনিট",
    sampleHeader: "ফুরিগানা ও ৮ ভাষার নমুনা প্রশ্ন প্রিভিউ",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "সম্পূর্ণ JLPT মক সিরিজ আনলক করুন (টেস্ট ৩–২০)",
    modalSubtitle: "আনলক করতে NihonSync Pro প্রয়োজন। প্রতিটি লেভেলে ২০টি পূর্ণাঙ্গ পরীক্ষা দিন।",
    modalCta: "এখনই প্রো আনলক করুন",
    modalLater: "ফ্রি টেস্ট (১–২) চালিয়ে যান",
  },
  hi: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "प्रत्येक स्तर पर टेस्ट 1–2 निःशुल्क • टेस्ट 3–20 अनलॉक करने के लिए Pro लें",
    ribbonProDesc: "सभी 100 JLPT N5–N1 मॉक टेस्ट और 8 भाषाओं की व्याख्या अनलॉक है",
    ribbonCta: "Pro में अपग्रेड करें",
    allTests: "सभी टेस्ट",
    freeTests: "निःशुल्क (टेस्ट 1–2)",
    proTests: "Pro (टेस्ट 3–20)",
    completedTests: "पूर्ण किए गए",
    free: "निःशुल्क",
    pro: "Pro",
    completed: "पूर्ण",
    inProgress: "जारी है",
    startTest: "मॉक टेस्ट शुरू करें",
    resumeTest: "जारी रखें",
    reviewResult: "समीक्षा देखें",
    unlockPro: "Pro से अनलॉक करें",
    progressLabel: "अनुभाग प्रगति",
    passMark: "उत्तीर्ण अंक",
    mins: "मिनट",
    sampleHeader: "फुरिगाना और 8-भाषा नमूना प्रश्न पूर्वावलोकन",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "पूर्ण JLPT मॉक सीरीज़ अनलॉक करें (टेस्ट 3–20)",
    modalSubtitle: "के लिए NihonSync Pro आवश्यक है। प्रत्येक स्तर पर 20 पूर्ण परीक्षाओं का अभ्यास करें।",
    modalCta: "अभी NihonSync Pro अनलॉक करें",
    modalLater: "निःशुल्क टेस्ट (1–2) जारी रखें",
  },
  id: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "Tes 1–2 Gratis per level • Upgrade untuk membuka Tes 3–20 (90+ ujian lengkap)",
    ribbonProDesc: "Semua 100 Ujian Simulasi JLPT N5–N1 & Penjelasan 8 Bahasa Terbuka",
    ribbonCta: "Upgrade ke Pro",
    allTests: "Semua Tes",
    freeTests: "Gratis (Tes 1–2)",
    proTests: "Pro (Tes 3–20)",
    completedTests: "Selesai Dikerjakan",
    free: "Gratis",
    pro: "Pro",
    completed: "Selesai",
    inProgress: "Sedang Berjalan",
    startTest: "Mulai Ujian Simulasi",
    resumeTest: "Lanjutkan Bagian",
    reviewResult: "Ulangi / Tinjau",
    unlockPro: "Buka dengan Pro",
    progressLabel: "Progres Bagian",
    passMark: "Lulus",
    mins: "menit",
    sampleHeader: "Pratinjau Soal Furigana & 8 Bahasa",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "Buka Seri Lengkap Simulasi JLPT (Tes 3–20)",
    modalSubtitle: "memerlukan NihonSync Pro. Berlatih dengan 20 paket ujian penuh per level.",
    modalCta: "Buka NihonSync Pro Sekarang",
    modalLater: "Lanjutkan dengan Tes Gratis (1–2)",
  },
  th: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "ทำข้อสอบชุดที่ 1–2 ฟรีทุกระดับ • อัปเกรดเพื่อปลดล็อกชุดที่ 3–20",
    ribbonProDesc: "ปลดล็อกข้อสอบจำลอง JLPT N5–N1 ครบทั้ง 100 ชุดและคำอธิบาย 8 ภาษาแล้ว",
    ribbonCta: "อัปเกรดเป็น Pro",
    allTests: "ข้อสอบทั้งหมด",
    freeTests: "ฟรี (ชุดที่ 1–2)",
    proTests: "Pro (ชุดที่ 3–20)",
    completedTests: "ทำเสร็จแล้ว",
    free: "ฟรี",
    pro: "Pro",
    completed: "เสร็จสิ้น",
    inProgress: "กำลังทำ",
    startTest: "เริ่มทำข้อสอบจำลอง",
    resumeTest: "ทำข้อสอบต่อ",
    reviewResult: "ดูเฉลย / ทำซ้ำ",
    unlockPro: "ปลดล็อกด้วย Pro",
    progressLabel: "ความคืบหน้าแต่ละพาร์ท",
    passMark: "เกณฑ์ผ่าน",
    mins: "นาที",
    sampleHeader: "ตัวอย่างข้อสอบฟุริงานะและคำอธิบาย 8 ภาษา",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "ปลดล็อกชุดข้อสอบ JLPT ฉบับเต็ม (ชุดที่ 3–20)",
    modalSubtitle: "ต้องใช้ NihonSync Pro ฝึกฝนกับข้อสอบเสมือนจริง 20 ชุดต่อระดับ",
    modalCta: "ปลดล็อก NihonSync Pro ทันที",
    modalLater: "ทำข้อสอบฟรีต่อ (ชุดที่ 1–2)",
  },
  vi: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "Miễn phí Đề 1–2 mỗi cấp độ • Nâng cấp để mở khóa Đề 3–20 (90+ đề thi thử)",
    ribbonProDesc: "Đã mở khóa toàn bộ 100 đề thi thử JLPT N5–N1 & giải thích 8 ngôn ngữ",
    ribbonCta: "Nâng cấp Pro",
    allTests: "Tất cả đề thi",
    freeTests: "Miễn phí (Đề 1–2)",
    proTests: "Pro (Đề 3–20)",
    completedTests: "Đã hoàn thành",
    free: "Miễn phí",
    pro: "Pro",
    completed: "Hoàn thành",
    inProgress: "Đang làm",
    startTest: "Bắt đầu thi thử",
    resumeTest: "Tiếp tục làm bài",
    reviewResult: "Xem lại / Thi lại",
    unlockPro: "Mở khóa với Pro",
    progressLabel: "Tiến độ phần thi",
    passMark: "Điểm đỗ",
    mins: "phút",
    sampleHeader: "Xem trước câu hỏi Furigana & giải thích 8 ngôn ngữ",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "Mở khóa trọn bộ đề thi thử JLPT (Đề 3–20)",
    modalSubtitle: "yêu cầu gói NihonSync Pro. Luyện tập với 20 đề thi chuẩn cho mỗi cấp độ.",
    modalCta: "Mở khóa NihonSync Pro ngay",
    modalLater: "Tiếp tục với đề miễn phí (1–2)",
  },
  zh: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "每级别第 1–2 套免费 • 升级解锁第 3–20 套（90+ 套全真模拟题）",
    ribbonProDesc: "已解锁全部 100 套 JLPT N5–N1 模拟试卷及 8 国语言解析",
    ribbonCta: "升级至 Pro",
    allTests: "全部试卷",
    freeTests: "免费（第 1–2 套）",
    proTests: "Pro（第 3–20 套）",
    completedTests: "已完成",
    free: "免费",
    pro: "Pro",
    completed: "已完成",
    inProgress: "进行中",
    startTest: "开始模拟考试",
    resumeTest: "继续答题",
    reviewResult: "查看解析 / 重测",
    unlockPro: "Pro 专享解锁",
    progressLabel: "科目进度",
    passMark: "合格线",
    mins: "分钟",
    sampleHeader: "振假名与 8 国语言解析交互预览",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "解锁完整 JLPT 模拟题库（第 3–20 套）",
    modalSubtitle: "需要 NihonSync Pro 会员。每个级别畅练 20 套全真模拟试卷。",
    modalCta: "立即解锁 NihonSync Pro",
    modalLater: "继续使用免费试卷（1–2）",
  },
  ko: {
    ribbonTitle: "NihonSync Pro",
    ribbonFreeDesc: "레벨별 1–2회 무료 • 업그레이드하여 3–20회(90+ 모의고사) 잠금 해제",
    ribbonProDesc: "JLPT N5–N1 전체 100회 모의고사 및 8개 언어 해설 잠금 해제됨",
    ribbonCta: "Pro 업그레이드",
    allTests: "전체 모의고사",
    freeTests: "무료 (1–2회)",
    proTests: "Pro (3–20회)",
    completedTests: "응시 완료",
    free: "무료",
    pro: "Pro",
    completed: "완료",
    inProgress: "진행 중",
    startTest: "모의고사 시작",
    resumeTest: "이어서 풀기",
    reviewResult: "결과 및 해설 보기",
    unlockPro: "Pro로 잠금 해제",
    progressLabel: "영역별 진행률",
    passMark: "합격 기준",
    mins: "분",
    sampleHeader: "후리가나 및 8개 언어 해설 미리보기",
    furiganaLabel: "ふりがな",
    modalBadge: "NihonSync Pro",
    modalTitle: "전체 JLPT 모의고사 시리즈 잠금 해제 (3–20회)",
    modalSubtitle: "응시에는 NihonSync Pro가 필요합니다. 레벨별 20회 실전 모의고사를 풀어보세요.",
    modalCta: "지금 NihonSync Pro 잠금 해제",
    modalLater: "무료 모의고사(1–2회) 계속하기",
  },
};

export function MockTestCatalog({
  exams,
  attempts,
  initialIsPro,
  initialLang,
}: MockTestCatalogProps) {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [lang, setLang] = useState<SupportedLang>(initialLang || "en");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [isPro, setIsPro] = useState<boolean>(initialIsPro);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [furiganaOn, setFuriganaOn] = useState<boolean>(true);
  const [paywallExam, setPaywallExam] = useState<Exam | null>(null);
  const [selectedSampleOption, setSelectedSampleOption] = useState<number | null>(
    null
  );

  const t = UI_COPY[lang] ?? UI_COPY.en;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Map user attempts to 0-100% sectional progress (33% per section)
  const progressByExamId = useMemo(() => {
    const map: Record<string, ExamProgressInfo> = {};
    for (const att of attempts) {
      const existing = map[att.exam_id];
      if (att.status === "completed") {
        map[att.exam_id] = {
          percent: 100,
          status: "completed",
          score: att.total_score,
          passed: att.passed,
        };
      } else if (att.status === "in_progress" && existing?.status !== "completed") {
        const sec = Math.max(1, Math.min(3, att.current_section || 1));
        const pct = sec === 1 ? 18 : sec === 2 ? 48 : 78;
        map[att.exam_id] = {
          percent: pct,
          status: "in_progress",
        };
      }
    }
    return map;
  }, [attempts]);

  const levelExams = useMemo(
    () =>
      exams
        .filter((e) => e.level === selectedLevel)
        .sort((a, b) => a.test_number - b.test_number),
    [exams, selectedLevel]
  );

  const filteredExams = useMemo(() => {
    return levelExams.filter((exam) => {
      const prog = progressByExamId[exam.id];
      if (categoryFilter === "free") return !exam.is_premium;
      if (categoryFilter === "pro") return exam.is_premium;
      if (categoryFilter === "completed") return prog?.status === "completed";
      return true;
    });
  }, [levelExams, categoryFilter, progressByExamId]);

  const activeSampleQuestion = useMemo(
    () =>
      SAMPLE_SEED_QUESTIONS.find((q) => q.level === selectedLevel) ??
      SAMPLE_SEED_QUESTIONS[0],
    [selectedLevel]
  );

  return (
    <div className={furiganaOn ? "" : "hide-furigana"}>
      {/* Vermilion NihonSync Pro Status Ribbon */}
      <div className="mb-6 rounded-[16px] border border-[#E04F33]/30 bg-[#FDF2EF] p-4 shadow-xs dark:border-[#E04F33]/40 dark:bg-[#E04F33]/12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E04F33] text-white shadow-xs">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#18181B] dark:text-[#F4F4F5]">
                  {t.ribbonTitle}
                </span>
                <span className="rounded-full bg-[#E04F33] px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {isPro ? "ACTIVE" : "FREE TIER"}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[#52525B] dark:text-[#A1A1AA]">
                {isPro ? t.ribbonProDesc : t.ribbonFreeDesc}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Furigana Toggle */}
            <button
              type="button"
              onClick={() => setFuriganaOn((v) => !v)}
              className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                furiganaOn
                  ? "border-[#E04F33] bg-white text-[#E04F33] dark:bg-[#18181B]"
                  : "border-[#E6E2DA] bg-white/70 text-[#52525B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]"
              }`}
            >
              {t.furiganaLabel}: {furiganaOn ? "ON" : "OFF"}
            </button>

            {/* Dark/Light Theme Toggle */}
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label="Toggle color theme"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E2DA] bg-white text-[#18181B] transition hover:border-[#E04F33] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* 8-Language Selector Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangMenuOpen((o) => !o)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-white px-3.5 py-2 text-xs font-bold text-[#18181B] transition hover:border-[#E04F33] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
              >
                <Globe className="h-4 w-4 text-[#E04F33]" />
                <span>{lang.toUpperCase()}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-[16px] border border-[#E6E2DA] bg-white p-2 shadow-xl dark:border-[#2E2E32] dark:bg-[#18181B]">
                  <div className="grid grid-cols-2 gap-1">
                    {SUPPORTED_LANGUAGES.map((item) => {
                      const active = item.code === lang;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            setLang(item.code);
                            setLangMenuOpen(false);
                          }}
                          className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                            active
                              ? "bg-[#FDF2EF] text-[#E04F33] ring-1 ring-[#E04F33] dark:bg-[#E04F33]/15"
                              : "text-[#18181B] hover:bg-[#F3F1ED] dark:text-[#F4F4F5] dark:hover:bg-[#27272A]"
                          }`}
                        >
                          <span className="leading-snug">{item.native}</span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {!isPro && (
              <button
                type="button"
                onClick={() =>
                  setPaywallExam(
                    levelExams.find((e) => e.is_premium) ?? levelExams[0]
                  )
                }
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#E04F33] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#C83E24]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t.ribbonCta}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Level Pills (N5 - N1) & Flexible Category Filter Pills */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* JLPT Level Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map((lvl) => {
            const active = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setSelectedLevel(lvl);
                  setSelectedSampleOption(null);
                }}
                style={{ padding: "10px 14px" }}
                className={`min-h-[44px] rounded-xl text-sm font-bold transition ${
                  active
                    ? "bg-[#E04F33] text-white shadow-xs"
                    : "border border-[#E6E2DA] bg-white text-[#18181B] hover:border-[#E04F33] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#F4F4F5]"
                }`}
              >
                JLPT {lvl}
              </button>
            );
          })}
        </div>

        {/* Category Filter Pills (Flexible sizing — never clips longer Indonesian/Hindi/Bangla text) */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: t.allTests },
              { id: "free", label: t.freeTests },
              { id: "pro", label: t.proTests },
              { id: "completed", label: t.completedTests },
            ] as { id: CategoryFilter; label: string }[]
          ).map((pill) => {
            const active = categoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setCategoryFilter(pill.id)}
                style={{ padding: "10px 14px" }}
                className={`min-h-[44px] rounded-xl text-xs font-bold leading-snug whitespace-normal text-center transition ${
                  active
                    ? "border-[1.5px] border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                    : "border border-[#E6E2DA] bg-white text-[#52525B] hover:border-[#E04F33]/50 hover:text-[#18181B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playable Sample Question Card (Demonstrates <ruby> Furigana & 8-Lang Explanation) */}
      {activeSampleQuestion && (
        <div className="mb-8 rounded-[16px] border border-[#E6E2DA] bg-white p-5 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E2DA] pb-3 dark:border-[#2E2E32]">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#E04F33]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#E04F33]">
                {t.sampleHeader} ({activeSampleQuestion.level})
              </span>
            </div>
            <span className="rounded-md bg-[#F3F1ED] px-2 py-0.5 text-[11px] font-semibold text-[#52525B] dark:bg-[#27272A] dark:text-[#A1A1AA]">
              {activeSampleQuestion.section_code}
            </span>
          </div>

          <div
            className="jp-furigana mt-3 text-base font-medium text-[#18181B] dark:text-[#F4F4F5] sm:text-lg"
            dangerouslySetInnerHTML={{ __html: activeSampleQuestion.prompt_html }}
          />

          <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
            {activeSampleQuestion.options.map((opt, i) => {
              const isSelected = selectedSampleOption === opt.index;
              const letter = ["A", "B", "C", "D"][i] ?? String(opt.index);
              return (
                <button
                  key={opt.index}
                  type="button"
                  onClick={() => setSelectedSampleOption(opt.index)}
                  className={`flex min-h-[48px] items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition ${
                    isSelected
                      ? "border-[1.5px] border-[#E04F33] bg-[#FDF2EF] dark:bg-[#E04F33]/15"
                      : "border border-[#E6E2DA] bg-white hover:border-[#E04F33]/50 dark:border-[#2E2E32] dark:bg-[#18181B]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] text-xs font-bold ${
                        isSelected
                          ? "bg-[#E04F33] text-white"
                          : "bg-[#F3F1ED] text-[#18181B] dark:bg-[#27272A] dark:text-[#F4F4F5]"
                      }`}
                    >
                      {letter}
                    </span>
                    <span
                      className="jp-furigana text-sm font-medium text-[#18181B] dark:text-[#F4F4F5]"
                      dangerouslySetInnerHTML={{ __html: opt.text }}
                    />
                  </div>
                  {isSelected && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E04F33] text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedSampleOption !== null && (
            <div className="mt-3.5 rounded-xl border border-[#E04F33]/30 bg-[#FDF2EF] p-3.5 text-xs leading-relaxed text-[#18181B] dark:bg-[#E04F33]/12 dark:text-[#F4F4F5]">
              <span className="font-bold text-[#E04F33]">
                [{lang.toUpperCase()}]{" "}
              </span>
              {activeSampleQuestion.explanation[lang] ||
                activeSampleQuestion.explanation.en}
            </div>
          )}
        </div>
      )}

      {/* Exam Cards Grid (20 Mock Exams per Level) */}
      {filteredExams.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#E6E2DA] bg-white p-10 text-center text-sm text-[#52525B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA]">
          No exams match this filter yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredExams.map((exam) => (
            <TestCard
              key={exam.id}
              exam={exam}
              isProUser={isPro}
              progress={
                progressByExamId[exam.id] ?? {
                  percent: 0,
                  status: "not_started",
                }
              }
              onUnlockClick={(targetExam) => setPaywallExam(targetExam)}
              labels={{
                free: t.free,
                pro: t.pro,
                completed: t.completed,
                inProgress: t.inProgress,
                startTest: t.startTest,
                resumeTest: t.resumeTest,
                reviewResult: t.reviewResult,
                unlockPro: t.unlockPro,
                progressLabel: t.progressLabel,
                passMark: t.passMark,
                mins: t.mins,
              }}
            />
          ))}
        </div>
      )}

      {/* Pro Unlock Modal */}
      <PaywallModal
        exam={paywallExam}
        onClose={() => setPaywallExam(null)}
        onUpgradeConfirm={() => setIsPro(true)}
        labels={{
          badge: t.modalBadge,
          title: t.modalTitle,
          subtitle: t.modalSubtitle,
          cta: t.modalCta,
          later: t.modalLater,
        }}
      />
    </div>
  );
}
