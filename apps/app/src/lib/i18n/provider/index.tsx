'use client';

import { IntlErrorCode, NextIntlClientProvider } from 'next-intl';
import { ReactNode, useEffect } from 'react';

type Props = {
  children: ReactNode;
  messages: Record<string, any>;
  locale: string;
};

type MessageFallbackParams = {
  namespace?: string;
  key: string;
  error: {
    code: string;
    message?: string;
  };
};

// We wrap our i18n provider to not throw errors on missing keys. We want to build out translation ability using "natural keys" without
// slowing down development so we can sweep back later and add the translations.
export const I18nProvider = ({ children, messages, locale }: Props) => {
  // Sync the lang attribute on client-side navigation since the root layout
  // doesn't re-render when the locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(error: { code: string; message?: string }): void => {
        if (error.code === IntlErrorCode.MISSING_MESSAGE) {
          // Silently ignore missing messages
          return;
        }
        console.error(error);
      }}
      getMessageFallback={({ key }: MessageFallbackParams): string => {
        // Just return the key as fallback without errors
        return key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
};
