"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { usePreferences } from "@/context/PreferencesContext";
import { TRANSLATIONS } from "@/i18n/translations";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const initialSignup = searchParams.get("mode") === "signup";
  const { lang } = usePreferences();
  const t = (TRANSLATIONS[lang] ?? TRANSLATIONS.en).auth;

  const [isSignUp, setIsSignUp] = useState(initialSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  async function handleResendConfirmation() {
    if (!email.trim() || resending) return;
    setResending(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    setResending(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setInfoMsg(t.resendSent);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setCanResend(false);

    const supabase = createClient();
    const cleanEmail = email.trim();

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
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
        return;
      }

      // If identities is empty, the email is already registered in Supabase
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorMsg("An account with this email already exists. Please switch to Log In or resend the confirmation link.");
        setCanResend(true);
        setLoading(false);
        return;
      }

      setInfoMsg(t.accountCreatedInfo);
      setCanResend(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      if (error.message.toLowerCase().includes("confirm")) {
        setCanResend(true);
      }
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-[16px] border border-[#E5E2DC] bg-white p-6 shadow-xs dark:border-[#27272A] dark:bg-[#18181B] sm:p-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E04F33] font-jp text-lg font-bold text-white shadow-xs"
        >
          日
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-[#F4F4F5]">
            {isSignUp ? t.signUpTitle : t.signInTitle}
          </h1>
          <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
            {t.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#F3F2EE] p-1 text-sm font-bold dark:bg-[#222226]">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(false);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={`min-h-[42px] rounded-lg py-1.5 transition ${
            !isSignUp
              ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#18181B] dark:text-[#F4F4F5]"
              : "text-[#475569] hover:text-[#0F172A] dark:text-[#A1A1AA]"
          }`}
        >
          {t.tabLogin}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(true);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className={`min-h-[42px] rounded-lg py-1.5 transition ${
            isSignUp
              ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#18181B] dark:text-[#F4F4F5]"
              : "text-[#475569] hover:text-[#0F172A] dark:text-[#A1A1AA]"
          }`}
        >
          {t.tabSignUp}
        </button>
      </div>

      {errorMsg && (
        <div className="mt-4 space-y-2 rounded-xl border border-[#E04F33]/40 bg-[#FDF2EF] p-3 text-xs font-medium text-[#E04F33] dark:bg-[#E04F33]/15">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          {canResend && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E04F33] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#C83E24] disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{resending ? "..." : t.resendBtn}</span>
            </button>
          )}
        </div>
      )}

      {infoMsg && (
        <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
          {canResend && (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{resending ? "..." : t.resendBtn}</span>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-bold uppercase tracking-wide text-[#475569] dark:text-[#A1A1AA]"
          >
            {t.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="learner@example.com"
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5E2DC] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#E04F33] focus:ring-2 focus:ring-[#E04F33]/20 dark:border-[#27272A] dark:bg-[#111113] dark:text-[#F4F4F5]"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold uppercase tracking-wide text-[#475569] dark:text-[#A1A1AA]"
          >
            {t.passwordLabel}
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
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E5E2DC] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#E04F33] focus:ring-2 focus:ring-[#E04F33]/20 dark:border-[#27272A] dark:bg-[#111113] dark:text-[#F4F4F5]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E23] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSignUp ? t.submitSignUp : t.submitLogin}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  const { lang } = usePreferences();
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F7] text-[#0F172A] dark:bg-[#111113] dark:text-[#F4F4F5]">
      <GlobalHeader
        showAuthActions={false}
        backHref="/"
        backLabel={dict.header.home}
      />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Suspense
          fallback={<div className="text-sm text-[#475569]">Loading...</div>}
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
