'use client';

import { type SupportedLocale, isSupportedLocale } from '@op/common/client';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

import { baseLanguage } from '@/lib/languageDetection';

export interface TranslationLocale {
  /**
   * The reader's locale, or `null` when it isn't one we can translate into —
   * every translate control keys its enabled state off this.
   */
  targetLocale: SupportedLocale | null;
  /** The reader's own language, localized: the "Translate to {x}" target. */
  targetLanguageName: string;
  /**
   * A source locale's language name, localized for the reader. Empty string
   * when there is no source locale yet, which is what the banners render.
   */
  getLanguageName: (sourceLocale: string | null | undefined) => string;
}

/**
 * The locale half of every translate affordance: whether we can translate into
 * the reader's language at all, and the localized language names the banners
 * print. Shared by the decision, proposal and review translation hooks, which
 * each held their own copy of this.
 *
 * The browser's `Intl.DisplayNames` localizes the names, so none of this needs
 * dictionary keys — a Spanish reader sees "inglés", an English one "Spanish".
 */
const useTranslationLocale = (): TranslationLocale => {
  const locale = useLocale();

  return useMemo(() => {
    const languageNames = new Intl.DisplayNames([locale], { type: 'language' });

    return {
      targetLocale: isSupportedLocale(locale) ? locale : null,
      targetLanguageName: languageNames.of(locale) ?? locale,
      // Detection and DeepL both answer with a base language ('en'), but a
      // source locale can arrive regional ('EN-US'), which Intl won't name.
      getLanguageName: (sourceLocale) =>
        sourceLocale
          ? (languageNames.of(baseLanguage(sourceLocale)) ?? '')
          : '',
    };
  }, [locale]);
};

export interface TranslationBanner extends TranslationLocale {
  /** Whether to offer the translate control at all. */
  showBanner: boolean;
  dismissBanner: () => void;
}

/**
 * The translate banner's own state, on top of `useTranslationLocale`: it is
 * offered only when there is foreign copy on screen, we can translate into the
 * reader's language, they haven't dismissed it, and nothing is translated yet
 * (once it is, "View original" is the control instead).
 *
 * That four-term condition and the dismissal state were re-derived in each of
 * the decision, proposal and review translation hooks. Centralized here so a
 * change in banner policy is one edit rather than three.
 */
export const useTranslationBanner = ({
  needsTranslation,
  isTranslated,
}: {
  needsTranslation: boolean;
  /** True once a translation is on screen. */
  isTranslated: boolean;
}): TranslationBanner => {
  const locale = useTranslationLocale();
  const [dismissed, setDismissed] = useState(false);

  return {
    ...locale,
    showBanner:
      !!locale.targetLocale && needsTranslation && !dismissed && !isTranslated,
    dismissBanner: () => setDismissed(true),
  };
};
