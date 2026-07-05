'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

import { baseLanguage, detectLanguages } from '@/lib/languageDetection';

/**
 * Returns `true` only when `text` contains content in a language other than the
 * active locale — i.e. when offering a translation is actually useful.
 *
 * Detection runs asynchronously (CLD loads a WASM binary), so this returns
 * `false` until the first result lands. That keeps the translate badge from
 * flashing before the language is known, and keeps it hidden whenever the
 * content is already in the reader's language.
 */
export const useContentNeedsTranslation = (text: string): boolean => {
  const locale = useLocale();
  const [needsTranslation, setNeedsTranslation] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!text.trim()) {
      setNeedsTranslation(false);
      return;
    }

    void detectLanguages(text).then((languages) => {
      if (cancelled) {
        return;
      }
      const localeLanguage = baseLanguage(locale);
      setNeedsTranslation(
        languages.some((language) => language !== localeLanguage),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [text, locale]);

  return needsTranslation;
};
