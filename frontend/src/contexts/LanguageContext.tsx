import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { en } from "../i18n/en";
import { ne } from "../i18n/ne";

export type Language = "en" | "ne";

const STORAGE_KEY = "language";

const dictionaries = { en, ne };

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "ne") return stored;
  return "en";
}

interface LanguageContextType {
  language: Language;
  t: typeof en;
  setLanguage: (language: Language) => void;
}

export const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  };

  return (
    <LanguageContext.Provider value={{ language, t: dictionaries[language], setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
