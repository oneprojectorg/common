import { useTranslations as _useTranslations } from 'next-intl';
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { useMemo } from 'react';

import { i18nConfig } from './config';
import type { KeysIn, MessageNamespace, TranslateFn } from './translate';
import { withNormalizedKeys } from './translate';

export type {
  KeysIn,
  MessageNamespace,
  TranslateFn,
  TranslationKey,
} from './translate';

export const routing = defineRouting(i18nConfig);

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const {
  Link: NavLink,
  redirect,
  usePathname,
  useRouter,
} = createNavigation(routing);

/**
 * `next-intl`'s hook, with the key substitution `translate.ts` documents.
 * Pass a namespace to key a feature's messages by ID relative to it
 * (ADR 0005); omit it for the shared top-level labels.
 */
const useTranslations = <
  Namespace extends MessageNamespace | undefined = undefined,
>(
  namespace?: Namespace,
): TranslateFn<KeysIn<Namespace>> => {
  const translator = _useTranslations(namespace);

  return useMemo(
    () => withNormalizedKeys<KeysIn<Namespace>>(translator),
    [translator],
  );
};

export { useTranslations };
export { Link } from './Link';
