'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/**
 * Returns `true` when any of the given text samples is in a language other than
 * the active locale — the list counterpart to {@link useContentNeedsTranslation}.
 *
 * Each distinct sample is detected once and cached, so as more items stream in
 * (e.g. paginating a proposals list) only the newly added samples are checked.
 * The result is sticky: once a foreign-language sample is seen it stays `true`,
 * and detection short-circuits. A locale change resets the cache and re-checks.
 */
export const useAnyContentNeedsTranslation = (samples: string[]): boolean => {
  const locale = useLocale();
  const [needsTranslation, setNeedsTranslation] = useState(false);
  const checkedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // A new locale invalidates every prior verdict.
    checkedRef.current = new Set();
    setNeedsTranslation(false);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    const localeLanguage = baseLanguage(locale);
    const pending = samples
      .map((sample) => sample.trim())
      .filter((sample) => sample && !checkedRef.current.has(sample));

    if (pending.length === 0) {
      return;
    }

    void (async () => {
      for (const sample of pending) {
        checkedRef.current.add(sample);
        const languages = await detectLanguages(sample);
        if (cancelled) {
          return;
        }
        if (languages.some((language) => language !== localeLanguage)) {
          setNeedsTranslation(true);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [samples, locale]);

  return needsTranslation;
};
