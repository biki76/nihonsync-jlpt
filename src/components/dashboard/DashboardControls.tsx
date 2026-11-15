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
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
        <Globe className="h-4 w-4 text-[#0F766E]" />
        <label htmlFor="lang-select" className="sr-only">
          Explanation Language
        </label>
        <select
          id="lang-select"
          value={lang}
          disabled={saving}
          onChange={(e) => handleLanguageChange(e.target.value as SupportedLang)}
          className="bg-transparent text-xs font-semibold text-[#1E293B] outline-none"
        >
          {SUPPORTED_LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code.toUpperCase()} — {item.native}
            </option>
          ))}
        </select>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0F766E]" />}
        {savedNotice && <Check className="h-3.5 w-3.5 text-emerald-600" />}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-[#1E293B]"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign Out
      </button>
    </div>
  );
}
