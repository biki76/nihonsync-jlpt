"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { usePreferences } from "@/context/PreferencesContext";
import { TRANSLATIONS } from "@/i18n/translations";

interface LandingContentProps {
  isLoggedIn: boolean;
}

export function LandingContent({ isLoggedIn }: LandingContentProps) {
  const { lang } = usePreferences();
  const t = (TRANSLATIONS[lang] ?? TRANSLATIONS.en).landing;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#E04F33]/35 bg-[#FDF2EF] px-3.5 py-1 text-xs font-bold text-[#E04F33] dark:bg-[#E04F33]/15">
          {t.badge}
        </p>

        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] dark:text-[#F4F4F5] sm:text-5xl">
          {t.heroTitle}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-[#475569] dark:text-[#A1A1AA] sm:text-lg">
          {t.heroDescBefore}{" "}
          <span className="jp-furigana font-semibold text-[#0F172A] dark:text-[#F4F4F5]">
            <ruby>
              振<rt>ふ</rt>り<rt></rt>仮<rt>が</rt>名<rt>な</rt>
            </ruby>
          </span>{" "}
          {t.heroDescAfter}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Link
            href={isLoggedIn ? "/dashboard" : "/login?mode=signup"}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#E04F33] px-6 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C83E23]"
          >
            <span>{isLoggedIn ? t.ctaPrimaryUser : t.ctaPrimaryGuest}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          {!isLoggedIn && (
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#E5E2DC] bg-white px-5 py-3.5 text-sm font-bold text-[#0F172A] transition hover:border-[#E04F33] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#F4F4F5]"
            >
              {t.ctaSignIn}
            </Link>
          )}
        </div>

        <p className="mt-3 text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
          {t.freeNote}
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
          <Clock className="h-5 w-5 text-[#E04F33]" />
          <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
            {t.f1Title}
          </h2>
          <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
            {t.f1Desc}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
          <BookOpen className="h-5 w-5 text-[#E04F33]" />
          <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
            {t.f2Title}
          </h2>
          <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
            {t.f2Desc}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
          <Headphones className="h-5 w-5 text-[#E04F33]" />
          <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
            {t.f3Title}
          </h2>
          <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
            {t.f3Desc}
          </p>
        </div>
        <div className="rounded-[16px] border border-[#E5E2DC] bg-white p-5 shadow-xs dark:border-[#27272A] dark:bg-[#18181B]">
          <CheckCircle2 className="h-5 w-5 text-[#E04F33]" />
          <h2 className="mt-3 font-bold text-[#0F172A] dark:text-[#F4F4F5]">
            {t.f4Title}
          </h2>
          <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
            {t.f4Desc}
          </p>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-2 text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#E04F33]" />
        <span>{t.gradingNote}</span>
      </div>
    </main>
  );
}
