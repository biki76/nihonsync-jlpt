"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SupportedLang } from "@/types/jlpt";

export type ThemeMode = "light" | "dark";

interface PreferencesContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  furigana: boolean;
  setFurigana: (show: boolean) => void;
  toggleFurigana: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
  defaultLang = "en",
}: {
  children: ReactNode;
  defaultLang?: SupportedLang;
}) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [lang, setLangState] = useState<SupportedLang>(defaultLang);
  const [furigana, setFuriganaState] = useState<boolean>(true);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("nihonsync-theme") as ThemeMode | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeState(savedTheme);
      }
      const savedLang = localStorage.getItem("nihonsync-lang") as SupportedLang | null;
      if (savedLang) {
        setLangState(savedLang);
      }
      const savedFuri = localStorage.getItem("nihonsync-furigana");
      if (savedFuri === "false") {
        setFuriganaState(false);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    try {
      localStorage.setItem("nihonsync-theme", theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("nihonsync-lang", lang);
    } catch {
      // Ignore
    }
  }, [lang]);

  useEffect(() => {
    const body = document.body;
    if (furigana) {
      body.classList.remove("hide-furigana");
    } else {
      body.classList.add("hide-furigana");
    }
    try {
      localStorage.setItem("nihonsync-furigana", String(furigana));
    } catch {
      // Ignore
    }
  }, [furigana]);

  function setTheme(next: ThemeMode) {
    setThemeState(next);
  }

  function toggleTheme() {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }

  function setLang(next: SupportedLang) {
    setLangState(next);
  }

  function setFurigana(next: boolean) {
    setFuriganaState(next);
  }

  function toggleFurigana() {
    setFuriganaState((prev) => !prev);
  }

  return (
    <PreferencesContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        lang,
        setLang,
        furigana,
        setFurigana,
        toggleFurigana,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
