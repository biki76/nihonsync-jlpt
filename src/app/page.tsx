import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, Headphones, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E293B]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F766E] font-jp text-lg font-bold text-white">
              日
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#1E293B]">
                NihonSync
              </span>
              <span className="ml-2 rounded-md bg-[#F0FDFA] px-2 py-0.5 text-xs font-semibold text-[#0F766E]">
                JLPT N5–N1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#115E59]"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:text-[#1E293B]"
                >
                  Log in
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#115E59]"
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
          <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-[#F0FDFA] px-3.5 py-1 text-xs font-semibold text-[#0F766E]">
            Official Exam Simulation • N5 through N1
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#1E293B] sm:text-5xl">
            Practice the JLPT under real exam rules and sectional scoring.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Timed Vocabulary, Grammar &amp; Reading, and Listening sections with{" "}
            <span className="jp-furigana font-medium text-[#1E293B]">
              <ruby>
                振<rt>ふ</rt>り<rt></rt>仮<rt>が</rt>名<rt>な</rt>
              </ruby>
            </span>{" "}
            support, restricted listening playback, and detailed answer reviews in 6 languages.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="rounded-xl bg-[#0F766E] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115E59]"
            >
              {user ? "Open Exam Dashboard" : "Take Free Mock Tests (1 & 2)"}
            </Link>
            <span className="text-xs text-slate-500">
              Free Tier includes Mock Tests 1–2 for every JLPT level.
            </span>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <Clock className="h-5 w-5 text-[#0F766E]" />
            <h2 className="mt-3 font-semibold text-[#1E293B]">Server-Synced Timers</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Authentic per-section countdowns backed by server timestamps and auto-submission.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <BookOpen className="h-5 w-5 text-[#0F766E]" />
            <h2 className="mt-3 font-semibold text-[#1E293B]">Washi Reading Layout</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              High-legibility Noto Sans JP typography with clean ruby furigana spacing.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <Headphones className="h-5 w-5 text-[#0F766E]" />
            <h2 className="mt-3 font-semibold text-[#1E293B]">Exam-Accurate Audio</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              No scrubbing during live listening tests; full transcripts unlocked in review.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <CheckCircle2 className="h-5 w-5 text-[#0F766E]" />
            <h2 className="mt-3 font-semibold text-[#1E293B]">6-Language Reviews</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Explanations in English, Vietnamese, Chinese, Korean, Bangla, and Hindi.
            </p>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
          <span>Official JLPT dual-condition grading: Total Score + Sectional Minimums.</span>
        </div>
      </main>
    </div>
  );
}
