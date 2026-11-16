export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type SupportedLang =
  | "en"
  | "bn"
  | "hi"
  | "id"
  | "th"
  | "vi"
  | "zh"
  | "ko";

export const SUPPORTED_LANGUAGES: {
  code: SupportedLang;
  label: string;
  native: string;
}[] = [
  { code: "en", label: "English", native: "English" },
  { code: "bn", label: "Bangla", native: "বাংলা" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "id", label: "Indonesian", native: "Indonesia" },
  { code: "th", label: "Thai", native: "ไทย" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ko", label: "Korean", native: "한국어" },
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

export interface ExamSection {
  id: string;
  exam_id: string;
  section_number: number;
  section_code: string;
  section_title_ja: string;
  section_title_en: string;
  time_limit_minutes: number;
}

export interface MondaiGroup {
  id: string;
  section_id: string;
  mondai_number: number;
  question_type: string;
  instruction_ja: string;
  passage_html: string | null;
}

export interface QuestionOption {
  index: number;
  text: string;
}

export interface PublicQuestion {
  id: string;
  mondai_group_id: string;
  question_number: number;
  prompt_html: string;
  options: QuestionOption[];
  points: number;
  audio_url: string | null;
  image_url: string | null;
}

export interface SeedQuestion {
  id: string;
  level: JlptLevel;
  section_code: "VOCAB" | "GRAMMAR_READING" | "LISTENING";
  mondai_number: number;
  question_type: string;
  instruction_ja: string;
  passage_html: string | null;
  question_number: number;
  prompt_html: string;
  options: QuestionOption[];
  correct_option: number;
  correct_sequence?: number[];
  points: number;
  transcript_ja?: string;
  explanation: Record<SupportedLang, string>;
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

export interface UserAnswer {
  id?: string;
  attempt_id: string;
  question_id: string;
  selected_option: number | null;
  is_flagged: boolean;
  is_correct?: boolean | null;
  updated_at?: string;
}
