'use client';

/*
 * Wraps text in the client side translation hook for SERVER components that need translated text.
 * Why: We need to shift to getTranslations but it doesn't yet support our dictionaries so we wrap this here so we can easily shift it out when it does.
 */
import { useTranslations } from '@/lib/i18n';

export const TranslatedText = ({ text }: { text: string }) => {
  const t = useTranslations();
  return t(text);
};
