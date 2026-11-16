"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  LogOut,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { usePreferences } from "@/context/PreferencesContext";
import { createClient } from "@/utils/supabase/client";
import type { SupportedLang } from "@/types/jlpt";

interface GlobalHeaderProps {
  userEmail?: string | null;
  userId?: string | null;
  backHref?: string;
  backLabel?: string;
  subtitle?: string;
  showAuthActions?: boolean;
}

const LANGUAGE_ITEMS: {
  code: SupportedLang;
  short: string;
  flag: string;
  native: string;
}[] = [
  { code: "en", short: "EN", flag: "🇬🇧", native: "English" },
  { code: "bn", short: "BN", flag: "🇧🇩", native: "বাংলা" },
  { code: "hi", short: "HI", flag: "🇮🇳", native: "हिन्दी" },
  { code: "id", short: "ID", flag: "🇮🇩", native: "Indonesia" },
  { code: "th", short: "TH", flag: "🇹🇭", native: "ไทย" },
  { code: "vi", short: "VI", flag: "🇻🇳", native: "Tiếng Việt" },
  { code: "zh", short: "ZH", flag: "🇨🇳", native: "中文" },
  { code: "ko", short: "KO", flag: "🇰🇷", native: "한국어" },
];

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSelectLang(nextLang: SupportedLang) {
    setLang(nextLang);
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

  const currentLangMeta =
    LANGUAGE_ITEMS.find((item) => item.code === lang) ?? LANGUAGE_ITEMS[0];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E2DC] bg-white/95 backdrop-blur dark:border-[#27272A] dark:bg-[#18181B]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Left: Clean Brand Identity */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href={userEmail ? "/dashboard" : "/"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E04F33] font-jp text-base font-bold text-white shadow-xs"
          >
            日
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={userEmail ? "/dashboard" : "/"}
                className="truncate text-base font-extrabold tracking-tight text-[#0F172A] dark:text-[#F4F4F5]"
              >
                NihonSync
              </Link>
              <span className="hidden shrink-0 rounded-md border border-[#E04F33]/35 bg-[#FDF2EF] px-2 py-0.5 text-[10px] font-bold text-[#E04F33] dark:bg-[#E04F33]/15 sm:inline-block">
                JLPT N5–N1
              </span>
            </div>

            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] transition hover:text-[#E04F33] dark:text-[#A1A1AA]"
              >
                <ArrowLeft className="h-3 w-3 shrink-0" />
                <span className="truncate">{backLabel || "Back"}</span>
              </Link>
            ) : subtitle ? (
              <p className="truncate text-xs text-[#475569] dark:text-[#A1A1AA]">
                {subtitle}
              </p>
            ) : userEmail ? (
              <p className="truncate text-xs text-[#475569] dark:text-[#A1A1AA]">
                {userEmail}
              </p>
            ) : null}
          </div>
        </div>

        {/* Right: Settings Gear Popover + Primary Auth Button */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              aria-label="Display & Language Settings"
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                settingsOpen
                  ? "border-[#E04F33] bg-[#FDF2EF] text-[#E04F33] dark:bg-[#E04F33]/15"
                  : "border-[#E5E2DC] bg-[#FAF9F7] text-[#0F172A] hover:border-[#E04F33] dark:border-[#27272A] dark:bg-[#111113] dark:text-[#F4F4F5]"
              }`}
            >
              <Settings className="h-4 w-4 text-[#E04F33]" />
              <span>{currentLangMeta.flag}</span>
              <span>{currentLangMeta.short}</span>
            </button>

            {settingsOpen && (
              <div
                role="dialog"
                aria-label="Settings"
                className="absolute right-0 z-50 mt-2 w-[296px] rounded-[16px] border border-[#E5E2DC] bg-white p-3.5 shadow-xl dark:border-[#27272A] dark:bg-[#18181B]"
              >
                <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-2.5 dark:border-[#27272A]">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A] dark:text-[#F4F4F5]">
                    Preferences
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    aria-label="Close settings"
                    className="rounded-lg p-1 text-[#64748B] hover:bg-[#F3F2EE] dark:text-[#A1A1AA] dark:hover:bg-[#222226]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Toggle Switches: Furigana & Theme */}
                <div className="mt-3 space-y-2.5">
                  {/* Furigana Switch */}
                  <div className="flex items-center justify-between rounded-xl bg-[#FAF9F7] px-3 py-2.5 dark:bg-[#111113]">
                    <div>
                      <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F5]">
                        <span className="font-jp">ふりがな</span> (Furigana)
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#A1A1AA]">
                        Kanji reading guides
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={furigana}
                      onClick={toggleFurigana}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        furigana
                          ? "bg-[#E04F33]"
                          : "bg-[#D6D2C9] dark:bg-[#3F3F46]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                          furigana ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Theme Switch */}
                  <div className="flex items-center justify-between rounded-xl bg-[#FAF9F7] px-3 py-2.5 dark:bg-[#111113]">
                    <div className="flex items-center gap-2">
                      {theme === "dark" ? (
                        <Moon className="h-4 w-4 text-[#E04F33]" />
                      ) : (
                        <Sun className="h-4 w-4 text-[#E04F33]" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F4F4F5]">
                          Dark Mode
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#A1A1AA]">
                          {theme === "dark" ? "Sumi Carbon" : "Warm Porcelain"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={theme === "dark"}
                      onClick={toggleTheme}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        theme === "dark"
                          ? "bg-[#E04F33]"
                          : "bg-[#D6D2C9] dark:bg-[#3F3F46]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                          theme === "dark" ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 8-Language Flag + Short Code Picker */}
                <div className="mt-3.5 border-t border-[#E5E2DC] pt-3 dark:border-[#27272A]">
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A1A1AA]">
                    Language (8)
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LANGUAGE_ITEMS.map((item) => {
                      const active = item.code === lang;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => handleSelectLang(item.code)}
                          className={`flex min-h-[40px] items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition ${
                            active
                              ? "bg-[#FDF2EF] text-[#E04F33] ring-1 ring-[#E04F33] dark:bg-[#E04F33]/15"
                              : "text-[#0F172A] hover:bg-[#F3F2EE] dark:text-[#F4F4F5] dark:hover:bg-[#222226]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm leading-none">
                              {item.flag}
                            </span>
                            <div>
                              <span className="block text-xs font-extrabold leading-tight">
                                {item.short}
                              </span>
                              <span className="block text-[10px] leading-tight opacity-75">
                                {item.native}
                              </span>
                            </div>
                          </div>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Primary Auth Action */}
          {showAuthActions &&
            (userEmail ? (
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign Out"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E2DC] bg-white px-3.5 text-xs font-bold text-[#475569] transition hover:border-[#E04F33] hover:text-[#0F172A] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#A1A1AA] dark:hover:text-[#F4F4F5]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#E04F33] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#C83E23]"
              >
                Log in
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
