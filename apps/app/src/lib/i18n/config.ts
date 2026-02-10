import { SUPPORTED_LOCALES } from '@op/common/client';
import type { SupportedLocale } from '@op/common/client';

export const i18nConfig = {
  defaultLocale: 'en' satisfies SupportedLocale,
  locales: [...SUPPORTED_LOCALES],
  localeDetection: true,
} as const;

export type Locale = SupportedLocale;

/** Human-readable names for supported locales, used as translation keys */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  bn: 'Bengali',
};
