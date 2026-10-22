import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

import { i18nConfig } from './config';

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

export { useTranslations } from 'next-intl';
export { Link } from './Link';
