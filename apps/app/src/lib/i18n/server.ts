import type { Locale } from 'next-intl';
import { getTranslations as getUnwrappedTranslations } from 'next-intl/server';

import type { TranslateFn } from './translate';
import { withNormalizedKeys } from './translate';

/**
 * Server-side counterpart to `useTranslations`. Import this rather than
 * `next-intl/server`'s `getTranslations`, which looks a key up verbatim and so
 * returns the English source string for any key containing a period.
 */
export const getTranslations = async (options?: {
  locale: Locale;
}): Promise<TranslateFn> =>
  withNormalizedKeys(await getUnwrappedTranslations(options));
