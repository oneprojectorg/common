'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/** The language `text` is in when it differs from the reader's locale, else undefined. */
export const useForeignContentLanguage = (text: string): string | undefined => {
  const locale = useLocale();

  return useMemo(() => {
    const localeLanguage = baseLanguage(locale);
    return detectLanguages(text).find(
      (language) => language !== localeLanguage,
    );
  }, [text, locale]);
};
