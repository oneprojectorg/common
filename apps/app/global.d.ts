/**
 * Module augmentation for next-intl.
 * Wires the English dictionary as the canonical message type so that
 * next-intl's internal type resolution (useTranslations, getTranslations)
 * is aware of all valid keys. Our custom TranslateFn in routing.tsx is the
 * client-facing contract; this augmentation supports next-intl internals.
 * See: https://next-intl.dev/docs/workflows/typescript
 */
import type messages from './src/lib/i18n/dictionaries/en.json';

type Messages = typeof messages;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
