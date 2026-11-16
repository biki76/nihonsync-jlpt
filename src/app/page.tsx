import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, Headphones, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#18181B] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <header className="border-b border-[#E6E2DA] bg-white dark:border-[#2E2E32] dark:bg-[#18181B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E04F33] font-jp text-lg font-bold text-white shadow-xs">
              日
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#18181B] dark:text-[#F4F4F5]">
                NihonSync
              </span>
              <span className="ml-2 rounded-md border border-[#E04F33]/30 bg-[#FDF2EF] px-2 py-0.5 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
                JLPT N5–N1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="min-h-[44px] inline-flex items-center rounded-xl bg-[#E04F33] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#C83E24]"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[#52525B] transition hover:text-[#18181B] dark:text-[#A1A1AA] dark:hover:text-[#F4F4F5]"
                >
                  Log in
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="min-h-[44px] inline-flex items-center rounded-xl bg-[#E04F33] px-4 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E24]"
                >
                  Start Free Mock Test
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#E04F33]/35 bg-[#FDF2EF] px-3.5 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
            Official Exam Simulation • N5 through N1
          </p>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#18181B] dark:text-[#F4F4F5] sm:text-5xl">
            Practice the JLPT under real exam rules and sectional scoring.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#52525B] dark:text-[#A1A1AA] sm:text-lg">
            Timed Vocabulary, Grammar &amp; Reading, and Listening sections with{" "}
            <span className="jp-furigana font-medium text-[#18181B] dark:text-[#F4F4F5]">
              <ruby>
                振<rt>ふ</rt>り<rt></rt>仮<rt>が</rt>名<rt>な</rt>
              </ruby>
            </span>{" "}
            support, restricted listening playback, and detailed answer reviews in 8 languages.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="min-h-[48px] inline-flex items-center rounded-xl bg-[#E04F33] px-6 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E24]"
            >
              {user ? "Open Exam Dashboard" : "Take Free Mock Tests (1 & 2)"}
            </Link>
            <span className="text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
              Free Tier includes Mock Tests 1–2 for every JLPT level.
            </span>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-5 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <Clock className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#18181B] dark:text-[#F4F4F5]">Server-Synced Timers</h2>
            <p className="mt-1.5 text-sm text-[#52525B] dark:text-[#A1A1AA]">
              Authentic per-section countdowns backed by server timestamps and auto-submission.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-5 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <BookOpen className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#18181B] dark:text-[#F4F4F5]">Pure Sumi &amp; Washi Layout</h2>
            <p className="mt-1.5 text-sm text-[#52525B] dark:text-[#A1A1AA]">
              High-legibility Noto Sans JP typography with clean ruby furigana spacing.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-5 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <Headphones className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#18181B] dark:text-[#F4F4F5]">Exam-Accurate Audio</h2>
            <p className="mt-1.5 text-sm text-[#52525B] dark:text-[#A1A1AA]">
              No scrubbing during live listening tests; full transcripts unlocked in review.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#E6E2DA] bg-white p-5 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B]">
            <CheckCircle2 className="h-5 w-5 text-[#E04F33]" />
            <h2 className="mt-3 font-bold text-[#18181B] dark:text-[#F4F4F5]">8-Language Reviews</h2>
            <p className="mt-1.5 text-sm text-[#52525B] dark:text-[#A1A1AA]">
              Explanations in English, Bangla, Hindi, Indonesian, Thai, Vietnamese, Chinese, and Korean.
            </p>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
          <ShieldCheck className="h-4 w-4 text-[#E04F33]" />
          <span>Official JLPT dual-condition grading: Total Score + Sectional Minimums.</span>
        </div>
      </main>
    </div>
  );
}
