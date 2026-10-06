import { SUPPORTED_LOCALES } from '@op/common/locales';
import type { SupportedLocale } from '@op/common/locales';

export const i18nConfig = {
  defaultLocale: 'en' satisfies SupportedLocale,
  locales: [...SUPPORTED_LOCALES],
  localeDetection: true,
} as const;

export type Locale = SupportedLocale;

const RTL_LOCALES = new Set<SupportedLocale>(['ar']);

export const getLocaleDirection = (locale: string): 'ltr' | 'rtl' =>
  RTL_LOCALES.has(locale as SupportedLocale) ? 'rtl' : 'ltr';

/** The locale the path is prefixed with, or undefined when it carries none. */
export const findPathLocale = (pathname: string): SupportedLocale | undefined =>
  i18nConfig.locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );
