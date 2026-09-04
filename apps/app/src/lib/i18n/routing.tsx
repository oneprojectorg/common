import { useTranslations as _useTranslations } from 'next-intl';
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { useMemo } from 'react';

import { i18nConfig } from './config';
import type { TranslateFn } from './translate';
import { withNormalizedKeys } from './translate';

export type { TranslateFn, TranslationKey } from './translate';

export const routing = defineRouting(i18nConfig);

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const {
  Link: NavLink,
  redirect,
  usePathname,
  useRouter,
} = createNavigation(routing);

const useTranslations = (): TranslateFn => {
  const translator = _useTranslations();

  return useMemo(() => withNormalizedKeys(translator), [translator]);
};

export { useTranslations };
export { Link } from './Link';
