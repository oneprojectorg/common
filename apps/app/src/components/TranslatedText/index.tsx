'use client';

/*
 * Wraps text in the client side translation hook for SERVER components that need translated text.
 *
 * Deprecated: this existed only because server-side getTranslations skipped our
 * dot-to-underscore key transformation. `getTranslations` from `@/lib/i18n` now
 * applies it, so a server component can translate without becoming a client one.
 * Prefer that — the remaining call sites move over in asana task 1218181433592952.
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
