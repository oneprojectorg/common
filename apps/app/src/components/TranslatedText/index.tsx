'use client';

/*
 * Wraps text in the client side translation hook for SERVER components that need translated text.
 * Why: Server-side getTranslations does not apply our custom dot-to-underscore key
 * transformation, so we use this client component wrapper instead.
 */
import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

export const TranslatedText = ({
  text,
  values,
}: {
  text: TranslationKey;
  values?: Record<string, unknown>;
}) => {
  const t = useTranslations();
  return t(text, values);
};
