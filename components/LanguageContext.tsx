'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getTranslation, type Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translation by dotted key from public/translations/{ru,kk}.json. */
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const STORAGE_KEY = 'language';

// The visitor's choice is kept in localStorage; server HTML is always Russian
// (one URL per page, no separate /kk routes — see docs/FINAL_AUDIT.md, SEO).
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ru');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'ru' || saved === 'kk') setLanguageState(saved);
    } catch {
      // Storage blocked (private mode): stay in Russian.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not persisted; the choice still applies to this page view.
    }
  }, []);

  const t = useCallback((key: string) => getTranslation(language, key) as string, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
