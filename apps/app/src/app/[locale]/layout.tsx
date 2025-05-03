import { setupSSR } from '@/utils/setupSSR';
import { getMessages } from 'next-intl/server';

import { I18nProvider } from '@/lib/i18n';

const AppLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) => {
  setupSSR({ params });
  const { locale } = await params;

  const messages = await getMessages();

  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>
  );
};

export default AppLayout;
