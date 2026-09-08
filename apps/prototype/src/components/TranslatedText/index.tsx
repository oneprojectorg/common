import type { TranslationKey } from '@/lib/i18n';

/**
 * PROTOTYPE ONLY.
 *
 * Stands in for the app's server-component translator. The prototype's `t` is
 * identity, so this is too — the key already is the English copy.
 */
export const TranslatedText = ({ text }: { text: TranslationKey }) => (
  <>{text}</>
);
