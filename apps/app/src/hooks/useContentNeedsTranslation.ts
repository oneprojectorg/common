'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/**
 * The language `text` is written in, when that differs from the active locale
 * — or `undefined` for empty/too-short text and for content already in the
 * reader's language. Callers that also need to name the language (a
 * "Translated from Spanish" label) use this; everyone else wants the boolean
 * {@link useContentNeedsTranslation}.
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

/**
 * Returns `true` when `text` is in a language other than the active locale —
 * i.e. when offering a translation is actually useful. Returns `false` for
 * empty/too-short text and for content already in the reader's language, so the
 * translate badge stays hidden unless there's really something to translate.
 */
export const useContentNeedsTranslation = (text: string): boolean =>
  useForeignContentLanguage(text) !== undefined;
