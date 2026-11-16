import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { GlobalHeader } from "@/components/layout/GlobalHeader";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#0F172A] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <GlobalHeader userEmail={user?.email ?? null} userId={user?.id ?? null} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#E04F33]/35 bg-[#FDF2EF] px-3.5 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
            Official Exam Simulation • N5 through N1
          </p>

          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] dark:text-[#F4F4F5] sm:text-5xl">
            Practice the JLPT under real exam rules and sectional scoring.
          </h1>

          <p className="mt-4 text-base leading-relaxed text-[#475569] dark:text-[#A1A1AA] sm:text-lg">
            Timed Vocabulary, Grammar &amp; Reading, and Listening sections with{" "}
            <span className="jp-furigana font-semibold text-[#0F172A] dark:text-[#F4F4F5]">
              <ruby>
                振<rt>ふ</rt>り<rt></rt>仮<rt>が</rt>名<rt>な</rt>
              </ruby>
            </span>{" "}
            support, restricted listening playback, and detailed answer reviews in 8 languages.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Link
              href={user ? "/dashboard" : "/login?mode=signup"}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-6 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E23]"
            >
              <span>
                {user ? "Open Exam Dashboard" : "Take Free Mock Tests (1 & 2)"}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {!user && (
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#E5E2DC] bg-white px-5 py-3.5 text-sm font-bold text-[#0F172A] transition hover:border-[#E04F33] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#F4F4F5]"
              >
                Sign In to Account
              </Link>
            )}
          </div>

          <p className="mt-3 text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
            Free Tier includes Mock Tests 1–2 for every JLPT level (N5–N1).
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
            <Clock className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
              Server-Synced Timers
            </h2>
            <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
              Authentic per-section countdowns backed by server timestamps and auto-submission.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
            <BookOpen className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
              Warm Porcelain &amp; Sumi
            </h2>
            <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
              High-legibility Noto Sans JP typography with clean ruby furigana spacing.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
            <Headphones className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
              Exam-Accurate Audio
            </h2>
            <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
              No scrubbing during live listening tests; full transcripts unlocked in review.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
            <CheckCircle2 className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
              8-Language Reviews
            </h2>
            <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
              Explanations in English, Bangla, Hindi, Indonesian, Thai, Vietnamese, Chinese, and Korean.
            </p>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#E04F33]" />
          <span>
            Official JLPT dual-condition grading: Total Score + Sectional Minimums.
          </span>
        </div>
      </main>
    </div>
  );
}
