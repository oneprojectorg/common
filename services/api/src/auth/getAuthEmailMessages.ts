import type { SupportedLocale } from '@op/common/locales';

import type englishDictionary from '../../../../apps/app/src/lib/i18n/dictionaries/en.json';

export type AuthEmailMessages = (typeof englishDictionary)['authEmail'];

// The app owns the dictionaries. A per-locale import loads only the one an
// email needs.
const dictionaries = {
  en: () => import('../../../../apps/app/src/lib/i18n/dictionaries/en.json'),
  es: () => import('../../../../apps/app/src/lib/i18n/dictionaries/es.json'),
  fr: () => import('../../../../apps/app/src/lib/i18n/dictionaries/fr.json'),
  pt: () => import('../../../../apps/app/src/lib/i18n/dictionaries/pt.json'),
  bn: () => import('../../../../apps/app/src/lib/i18n/dictionaries/bn.json'),
  so: () => import('../../../../apps/app/src/lib/i18n/dictionaries/so.json'),
  ar: () => import('../../../../apps/app/src/lib/i18n/dictionaries/ar.json'),
  hu: () => import('../../../../apps/app/src/lib/i18n/dictionaries/hu.json'),
} satisfies Record<
  SupportedLocale,
  () => Promise<{ default: { authEmail: AuthEmailMessages } }>
>;

export const getAuthEmailMessages = async (
  locale: SupportedLocale,
): Promise<AuthEmailMessages> =>
  (await dictionaries[locale]()).default.authEmail;
