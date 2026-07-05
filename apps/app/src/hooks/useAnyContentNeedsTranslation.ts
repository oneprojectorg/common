'use client';

import { useLocale } from 'next-intl';
import { useMemo, useRef } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/**
 * Returns `true` when any of the given text samples is in a language other than
 * the active locale — the list counterpart to {@link useContentNeedsTranslation}.
 *
 * Each distinct sample is detected once and cached, so as more items stream in
 * (e.g. paginating a proposals list) only the newly added samples are detected;
 * detection short-circuits as soon as a foreign-language sample is found. A
 * locale change clears the cache so verdicts are recomputed against it.
 */
export const useAnyContentNeedsTranslation = (samples: string[]): boolean => {
  const locale = useLocale();
  const cacheRef = useRef<Map<string, string[]>>(new Map());
  const localeRef = useRef(locale);

  if (localeRef.current !== locale) {
    localeRef.current = locale;
    cacheRef.current = new Map();
  }

  return useMemo(() => {
    const localeLanguage = baseLanguage(locale);
    const cache = cacheRef.current;

    return samples.some((raw) => {
      const sample = raw.trim();
      if (!sample) {
        return false;
      }
      let languages = cache.get(sample);
      if (!languages) {
        languages = detectLanguages(sample);
        cache.set(sample, languages);
      }
      return languages.some((language) => language !== localeLanguage);
    });
  }, [samples, locale]);
};
