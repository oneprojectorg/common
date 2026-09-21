/**
 * Module augmentation for next-intl.
 * Wires the English dictionary as the canonical message type. It is what
 * types the keys and the values of useTranslations and getTranslations, so a
 * call site names its key inline and next-intl checks it. TranslateFn and
 * TranslationKey in src/lib/i18n/translate.ts are aliases over it.
 * See: https://next-intl.dev/docs/workflows/typescript
 */
import type messages from './src/lib/i18n/dictionaries/en.json';

type Messages = typeof messages;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
