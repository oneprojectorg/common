import { SUPPORTED_LOCALES } from '@op/common/client';
import type { SupportedLocale } from '@op/common/client';

export const i18nConfig = {
  defaultLocale: 'en' satisfies SupportedLocale,
  locales: [...SUPPORTED_LOCALES],
  localeDetection: true,
} as const;

export type Locale = SupportedLocale;
