import type messages from './src/lib/i18n/dictionaries/en.json';

type Messages = typeof messages;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
