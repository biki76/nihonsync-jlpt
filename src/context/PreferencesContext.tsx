"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SupportedLang } from "@/types/jlpt";

interface PreferencesContextValue {
  lang: SupportedLang;
  setLang: (next: SupportedLang) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  furigana: boolean;
  toggleFurigana: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  lang: "en",
  setLang: () => {},
  theme: "light",
  toggleTheme: () => {},
  furigana: true,
  toggleFurigana: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SupportedLang>("en");
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [furigana, setFuriganaState] = useState<boolean>(true);

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("nihonsync_lang") as SupportedLang | null;
      if (savedLang) setLangState(savedLang);

      const savedTheme = localStorage.getItem("nihonsync_theme") as "light" | "dark" | null;
      if (savedTheme === "dark") {
        setThemeState("dark");
        document.documentElement.classList.add("dark");
      } else {
        setThemeState("light");
        document.documentElement.classList.remove("dark");
      }

      const savedFuri = localStorage.getItem("nihonsync_furigana");
      if (savedFuri === "false") {
        setFuriganaState(false);
        document.documentElement.classList.add("hide-furigana");
      }
    } catch {
      // Ignore storage access restrictions
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("nihonsync_lang", lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("nihonsync_theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    if (furigana) {
      document.documentElement.classList.remove("hide-furigana");
    } else {
      document.documentElement.classList.add("hide-furigana");
    }
    try {
      localStorage.setItem("nihonsync_furigana", String(furigana));
    } catch {}
  }, [furigana]);

  return (
    <PreferencesContext.Provider
      value={{
        lang,
        setLang: setLangState,
        theme,
        toggleTheme: () =>
          setThemeState((prev) => (prev === "light" ? "dark" : "light")),
        furigana,
        toggleFurigana: () => setFuriganaState((prev) => !prev),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
