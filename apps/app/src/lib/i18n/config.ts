import { SUPPORTED_LOCALES } from '@op/common/locales';
import type { SupportedLocale } from '@op/common/locales';

export const i18nConfig = {
  defaultLocale: 'en' satisfies SupportedLocale,
  locales: [...SUPPORTED_LOCALES],
  localeDetection: true,
} as const;

export type Locale = SupportedLocale;

/**
 * The time zone every formatted timestamp renders in, server and client alike.
 *
 * A timestamp must produce the same string in both passes or hydration fails
 * (React #418): `2026-07-06T04:00:00Z` is "Jul 6" in UTC and "Jul 5" in
 * America/Los_Angeles. The browser never sends its zone with a request, so the
 * server cannot know it — pinning one zone is what keeps the two passes equal.
 *
 * This is the single point to change if the app ever renders in the viewer's
 * own zone: feed it from a client-set cookie in `request.ts` and pass the same
 * value to `I18nProvider`, and both passes still agree.
 */
export const APP_TIME_ZONE = 'UTC';

const RTL_LOCALES = new Set<SupportedLocale>(['ar']);

export const getLocaleDirection = (locale: string): 'ltr' | 'rtl' =>
  RTL_LOCALES.has(locale as SupportedLocale) ? 'rtl' : 'ltr';
