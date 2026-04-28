import { useCallback, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n';
import { LangContext } from './LangContext';

const STORAGE_KEY = 'ontoreview.lang';

function readInitialLang() {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage?.getItem(STORAGE_KEY);
  if (stored === 'ko' || stored === 'en') return stored;
  const browser = window.navigator?.language?.toLowerCase() ?? '';
  return browser.startsWith('ko') ? 'ko' : 'en';
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(readInitialLang);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((path) => {
    const keys = path.split('.');
    let val = translations[lang];
    for (const k of keys) val = val?.[k];
    return val ?? path;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
