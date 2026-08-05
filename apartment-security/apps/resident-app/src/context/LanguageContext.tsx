import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations';
import tokenStorage from '../utils/tokenStorage';

const LANGUAGE_STORAGE_KEY = 'languagePreference';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    tokenStorage.getItemAsync(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'hi') setLanguageState(stored);
      setHydrated(true);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    tokenStorage.setItemAsync(LANGUAGE_STORAGE_KEY, lang).catch(() => {});
  };

  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t: (key, vars) => {
      let str = translations[language][key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const k of Object.keys(vars)) {
          str = str.replace(`{${k}}`, String(vars[k]));
        }
      }
      return str;
    },
  }), [language]);

  if (!hydrated) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
