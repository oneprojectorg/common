'use client';

/*
 * Wraps text in the client side translation hook
 */
import { useTranslations } from '@/lib/i18n';

export const TranslatedText = ({ text }: { text: string }) => {
  const t = useTranslations();
  return t(text);
};
