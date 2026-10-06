import { ReactNode, useEffect } from 'react';
import { IntlProvider } from 'use-intl';
import type { AbstractIntlMessages } from 'use-intl';

import { getMessageFallback, onProviderError } from '../errorHandling';

type Props = {
  children: ReactNode;
  messages: AbstractIntlMessages;
  locale: string;
};

export const I18nProvider = ({ children, messages, locale }: Props) => {
  // Sync the lang attribute on client-side navigation since the root document
  // doesn't re-render when the locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <IntlProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      onError={onProviderError}
      getMessageFallback={getMessageFallback}
    >
      {children}
    </IntlProvider>
  );
};
