import type { Locale } from 'next-intl';
import { getTranslations as getUnwrappedTranslations } from 'next-intl/server';

import type { KeysIn, MessageNamespace, TranslateFn } from './translate';
import { withNormalizedKeys } from './translate';

/**
 * Server-side counterpart to `useTranslations`. Import this rather than
 * `next-intl/server`'s `getTranslations`, which looks a key up verbatim and so
 * returns the English source string for any legacy key containing a period.
 *
 * Pass `namespace` to key a feature's messages by ID relative to it
 * (ADR 0005); omit it for the shared top-level labels.
 */
export const getTranslations = async <
  Namespace extends MessageNamespace | undefined = undefined,
>(options?: {
  locale?: Locale;
  namespace?: Namespace;
}): Promise<TranslateFn<KeysIn<Namespace>>> => {
  const locale = options?.locale;
  const namespace = options?.namespace;

  // next-intl takes the locale only in its object form, and that form requires
  // one, so the namespace-only overload covers a request-scoped call.
  const translator =
    locale === undefined
      ? await getUnwrappedTranslations(namespace)
      : await getUnwrappedTranslations({ locale, namespace });

  return withNormalizedKeys<KeysIn<Namespace>>(translator);
};
