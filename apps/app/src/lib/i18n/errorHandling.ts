import { logger } from '@op/logging/client';
import { IntlErrorCode } from 'use-intl';
import type { IntlError } from 'use-intl';

/**
 * For the provider behind `useTranslations`. A missing message is expected
 * there — new keys ship in English first and are swept into the other
 * dictionaries later — and the timeZone/now fallbacks are non-fatal, so
 * neither is logged.
 */
export const onProviderError = (error: IntlError) => {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    return;
  }

  onTranslatorError(error);
};

/**
 * For `getTranslations`, whose strings land in titles and metadata, where a
 * raw key is easy to miss — so a missing message is logged.
 */
export const onTranslatorError = (error: IntlError) => {
  if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) {
    return;
  }

  logger.error('Intl error', { error, context: 'i18n' });
};

/** A missing message renders as its key rather than throwing. */
export const getMessageFallback = ({ key }: { key: string }) => key;
