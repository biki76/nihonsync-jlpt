"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const initialSignup = searchParams.get("mode") === "signup";

  const [isSignUp, setIsSignUp] = useState(initialSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const supabase = createClient();

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push(nextPath);
        router.refresh();
      } else {
        setInfoMsg("Account created! Check your email for the confirmation link, then sign in.");
        setLoading(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-[16px] border border-[#E6E2DA] bg-white p-6 shadow-xs dark:border-[#2E2E32] dark:bg-[#18181B] sm:p-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E04F33] font-jp text-lg font-bold text-white shadow-xs"
        >
          日
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#18181B] dark:text-[#F4F4F5]">
            {isSignUp ? "Create NihonSync Account" : "Sign in to NihonSync"}
          </h1>
          <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
            JLPT N5–N1 Mock Exam Simulator
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#F3F1ED] p-1 text-sm font-bold dark:bg-[#27272A]">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(false);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={`min-h-[40px] rounded-lg py-1.5 transition ${
            !isSignUp
              ? "bg-white text-[#18181B] shadow-xs dark:bg-[#18181B] dark:text-[#F4F4F5]"
              : "text-[#52525B] hover:text-[#18181B] dark:text-[#A1A1AA]"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(true);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={`min-h-[40px] rounded-lg py-1.5 transition ${
            isSignUp
              ? "bg-white text-[#18181B] shadow-xs dark:bg-[#18181B] dark:text-[#F4F4F5]"
              : "text-[#52525B] hover:text-[#18181B] dark:text-[#A1A1AA]"
          }`}
        >
          Sign Up
        </button>
      </div>

      {errorMsg && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#E04F33]/40 bg-[#FDF2EF] p-3 text-xs font-medium text-[#E04F33] dark:bg-[#E04F33]/15">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{infoMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-bold uppercase tracking-wide text-[#52525B] dark:text-[#A1A1AA]"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="learner@example.com"
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E6E2DA] bg-white px-3.5 py-2.5 text-sm text-[#18181B] outline-none transition focus:border-[#E04F33] focus:ring-2 focus:ring-[#E04F33]/20 dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#F4F4F5]"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold uppercase tracking-wide text-[#52525B] dark:text-[#A1A1AA]"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E6E2DA] bg-white px-3.5 py-2.5 text-sm text-[#18181B] outline-none transition focus:border-[#E04F33] focus:ring-2 focus:ring-[#E04F33]/20 dark:border-[#2E2E32] dark:bg-[#111113] dark:text-[#F4F4F5]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E24] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSignUp ? "Create Free Account" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F7] px-4 py-12 dark:bg-[#111113]">
      <Suspense fallback={<div className="text-sm text-[#52525B]">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
