export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type SupportedLang = "en" | "vi" | "zh" | "ko" | "bn" | "hi";

export const SUPPORTED_LANGUAGES: { code: SupportedLang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "bn", label: "Bangla", native: "বাংলা" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

export interface Profile {
  id: string;
  is_pro: boolean;
  preferred_lang: SupportedLang;
  updated_at: string;
}

export interface Exam {
  id: string;
  exam_code: string;
  level: JlptLevel;
  test_number: number;
  title: string;
  is_premium: boolean;
  total_time_minutes: number;
  total_score_required: number;
  max_total_score: number;
  sectional_minimums: Record<string, number>;
  is_published: boolean;
  created_at: string;
}

export interface UserAttempt {
  id: string;
  user_id: string;
  exam_id: string;
  status: "in_progress" | "completed" | "abandoned";
  current_section: number;
  started_at: string;
  section_started_at: string;
  completed_at: string | null;
  section_scores: Record<string, number> | null;
  total_score: number | null;
  passed: boolean | null;
  exams?: {
    exam_code: string;
    level: JlptLevel;
    title: string;
    max_total_score: number;
  };
}
