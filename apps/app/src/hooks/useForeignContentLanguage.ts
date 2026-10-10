'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/**
 * The language `text` is written in, when that differs from the active locale
 * — i.e. when offering a translation is actually useful. `undefined` for
 * empty/too-short text and for content already in the reader's language, so
 * the translate link stays hidden unless there's really something to
 * translate, and names the language when there is.
 */
export const useForeignContentLanguage = (text: string): string | undefined => {
  const locale = useLocale();

  return useMemo(() => {
    const localeLanguage = baseLanguage(locale);
    return detectLanguages(text).find(
      (language) => language !== localeLanguage,
    );
  }, [text, locale]);
};
