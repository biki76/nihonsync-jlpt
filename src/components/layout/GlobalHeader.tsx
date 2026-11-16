"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { usePreferences } from "@/context/PreferencesContext";
import { TRANSLATIONS } from "@/i18n/translations";
import { createClient } from "@/utils/supabase/client";
import { SUPPORTED_LANGUAGES, type SupportedLang } from "@/types/jlpt";

interface GlobalHeaderProps {
  userEmail?: string | null;
  userId?: string | null;
  backHref?: string;
  backLabel?: string;
  subtitle?: string;
  showAuthActions?: boolean;
}

export function GlobalHeader({
  userEmail,
  userId,
  backHref,
  backLabel,
  subtitle,
  showAuthActions = true,
}: GlobalHeaderProps) {
  const router = useRouter();
  const { lang, setLang, theme, toggleTheme, furigana, toggleFurigana } =
    usePreferences();
  const [langOpen, setLangOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleSelectLang(nextLang: SupportedLang) {
    setLang(nextLang);
    setLangOpen(false);
    if (userId) {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            preferred_lang: nextLang,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      router.refresh();
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E2DC] bg-white/95 backdrop-blur dark:border-[#27272A] dark:bg-[#18181B]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Left: Brand Identity */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <Link
            href={userEmail ? "/dashboard" : "/"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E04F33] font-jp text-base font-bold text-white shadow-xs"
          >
            日
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={userEmail ? "/dashboard" : "/"}
                className="truncate text-sm font-extrabold tracking-tight text-[#0F172A] dark:text-[#F4F4F5] sm:text-base"
              >
                NihonSync
              </Link>
              <span className="hidden shrink-0 rounded-md border border-[#E04F33]/35 bg-[#FDF2EF] px-1.5 py-0.5 text-[10px] font-bold text-[#E04F33] dark:bg-[#E04F33]/15 sm:inline-block">
                JLPT N5–N1
              </span>
            </div>

            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#475569] transition hover:text-[#E04F33] dark:text-[#A1A1AA]"
              >
                <ArrowLeft className="h-3 w-3 shrink-0" />
                <span className="truncate">{backLabel || dict.header.home}</span>
              </Link>
            ) : subtitle ? (
              <p className="truncate text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                {subtitle}
              </p>
            ) : userEmail ? (
              <p className="truncate text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                {userEmail}
              </p>
            ) : null}
          </div>
        </div>

        {/* Right: Furigana, Theme, 8-Lang Popover, Auth */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleFurigana}
            title="Toggle Japanese Furigana"
            aria-pressed={furigana}
            className={`inline-flex h-9 items-center justify-center rounded-xl border px-2.5 text-xs font-bold transition sm:h-10 sm:px-3 ${
              furigana
                ? "border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                : "border-[#E5E2DC] bg-[#FAF9F7] text-[#475569] hover:text-[#0F172A] dark:border-[#27272A] dark:bg-[#111113] dark:text-[#A1A1AA]"
            }`}
          >
            <span className="font-jp">ふり</span>
            <span className="ml-1 hidden md:inline">
              {furigana ? "ON" : "OFF"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Light or Dark Theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] text-[#0F172A] transition hover:border-[#E04F33] hover:text-[#E04F33] dark:border-[#27272A] dark:bg-[#111113] dark:text-[#F4F4F5] sm:h-10 sm:w-10"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              aria-expanded={langOpen}
              aria-label="Select Language"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] px-2.5 text-xs font-bold text-[#0F172A] transition hover:border-[#E04F33] dark:border-[#27272A] dark:bg-[#111113] dark:text-[#F4F4F5] sm:h-10 sm:px-3"
            >
              <Globe className="h-3.5 w-3.5 text-[#E04F33]" />
              <span>{lang.toUpperCase()}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {langOpen && (
              <div className="absolute right-0 z-50 mt-2 w-64 rounded-[16px] border border-[#E5E2DC] bg-white p-2 shadow-xl dark:border-[#27272A] dark:bg-[#18181B]">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A1A1AA]">
                  {dict.header.langMenuTitle}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {SUPPORTED_LANGUAGES.map((item) => {
                    const active = item.code === lang;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelectLang(item.code)}
                        className={`flex min-h-[42px] items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                          active
                            ? "bg-[#FDF2EF] text-[#E04F33] ring-1 ring-[#E04F33] dark:bg-[#E04F33]/15"
                            : "text-[#0F172A] hover:bg-[#F3F2EE] dark:text-[#F4F4F5] dark:hover:bg-[#222226]"
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

          {showAuthActions &&
            (userEmail ? (
              <button
                type="button"
                onClick={handleSignOut}
                title={dict.header.signOut}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E5E2DC] bg-white px-2.5 text-xs font-semibold text-[#475569] transition hover:border-[#E04F33] hover:text-[#0F172A] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#A1A1AA] sm:h-10 sm:px-3"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{dict.header.signOut}</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-[#E04F33] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#C83E23] sm:h-10 sm:px-4"
              >
                {dict.header.login}
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
