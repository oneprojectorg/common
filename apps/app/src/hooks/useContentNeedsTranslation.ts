'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/**
 * Returns `true` when `text` is in a language other than the active locale —
 * i.e. when offering a translation is actually useful. Returns `false` for
 * empty/too-short text and for content already in the reader's language, so the
 * translate badge stays hidden unless there's really something to translate.
 */
export const useContentNeedsTranslation = (text: string): boolean => {
  const locale = useLocale();

  return useMemo(() => {
    const localeLanguage = baseLanguage(locale);
    return detectLanguages(text).some(
      (language) => language !== localeLanguage,
    );
  }, [text, locale]);
};
