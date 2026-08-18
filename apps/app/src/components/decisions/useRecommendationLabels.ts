'use client';

import {
  RECOMMENDATION_OPTION,
  type RecommendationValue,
} from '@op/common/client';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/routing';

/**
 * Dictionary keys for the overall-recommendation copy, which is ours and not the
 * admin's: `enableOverallRecommendation` writes the prompt and the Yes/Maybe/No
 * labels into the rubric schema in English, and no builder screen can edit them.
 *
 * Rendering them straight from the schema shipped English to every locale — an
 * Arabic reviewer read "Overall Recommendation / Yes / Maybe / No" — and made an
 * otherwise Spanish rubric look part-English to language detection. Reading them
 * from the dictionary fixes both; the translation pipeline skips the field for
 * the same reason (see `getTranslatableRubricCopy`).
 */
const RECOMMENDATION_TITLE_KEY: TranslationKey = 'Overall Recommendation';

// Built through `satisfies` so a new recommendation option fails to compile
// until it has a dictionary key, then flattened to a string-keyed map so a
// stored answer can be looked up without asserting its type.
const RECOMMENDATION_LABEL_KEYS = new Map<string, TranslationKey>(
  Object.entries({
    [RECOMMENDATION_OPTION.YES.value]: 'Yes',
    [RECOMMENDATION_OPTION.MAYBE.value]: 'Maybe',
    [RECOMMENDATION_OPTION.NO.value]: 'No',
  } satisfies Record<RecommendationValue, TranslationKey>),
);

export interface RecommendationLabels {
  /** The criterion's prompt, localized. */
  title: string;
  /**
   * The localized label for one stored answer, or `undefined` for a value that
   * is not one of ours — the caller falls back to what the schema holds rather
   * than printing nothing.
   */
  label: (value: unknown) => string | undefined;
}

/** Localized copy for the overall-recommendation criterion. */
export function useRecommendationLabels(): RecommendationLabels {
  const t = useTranslations();

  return useMemo(
    () => ({
      title: t(RECOMMENDATION_TITLE_KEY),
      label: (value: unknown) => {
        if (typeof value !== 'string') {
          return undefined;
        }
        const key = RECOMMENDATION_LABEL_KEYS.get(value);
        return key ? t(key) : undefined;
      },
    }),
    [t],
  );
}
