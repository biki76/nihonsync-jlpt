"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { SUPPORTED_LANGUAGES, type SupportedLang } from "@/types/jlpt";

interface DashboardControlsProps {
  userId: string;
  initialLang: SupportedLang;
}

export function DashboardControls({ userId, initialLang }: DashboardControlsProps) {
  const router = useRouter();
  const [lang, setLang] = useState<SupportedLang>(initialLang);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  async function handleLanguageChange(nextLang: SupportedLang) {
    setLang(nextLang);
    setSaving(true);
    setSavedNotice(false);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .upsert(
        { id: userId, preferred_lang: nextLang, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    setSaving(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-white px-3 py-2 dark:border-[#2E2E32] dark:bg-[#18181B]">
        <Globe className="h-4 w-4 shrink-0 text-[#E04F33]" />
        <label htmlFor="lang-select" className="sr-only">
          Explanation Language
        </label>
        <select
          id="lang-select"
          value={lang}
          disabled={saving}
          onChange={(e) => handleLanguageChange(e.target.value as SupportedLang)}
          className="bg-transparent text-xs font-bold text-[#18181B] outline-none dark:text-[#F4F4F5]"
        >
          {SUPPORTED_LANGUAGES.map((item) => (
            <option
              key={item.code}
              value={item.code}
              className="bg-white text-[#18181B] dark:bg-[#18181B] dark:text-[#F4F4F5]"
            >
              {item.code.toUpperCase()} — {item.native}
            </option>
          ))}
        </select>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E04F33]" />}
        {savedNotice && <Check className="h-3.5 w-3.5 text-[#E04F33]" />}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-white px-3.5 py-2 text-xs font-semibold text-[#52525B] transition hover:border-[#E04F33] hover:text-[#18181B] dark:border-[#2E2E32] dark:bg-[#18181B] dark:text-[#A1A1AA] dark:hover:text-[#F4F4F5]"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>Sign Out</span>
      </button>
    </div>
  );
}
