import { setupSSR } from '@/utils/setupSSR';
import { getMessages } from 'next-intl/server';

import { I18nProvider } from '@/lib/i18n';

import { ReactAriaRouterProvider } from '@/components/ReactAriaRouterProvider';

const AppLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) => {
  setupSSR({ params });
  const { locale } = await params;

  const messages = await getMessages({ locale });

  return (
    <I18nProvider locale={locale} messages={messages}>
      <ReactAriaRouterProvider>{children}</ReactAriaRouterProvider>
    </I18nProvider>
  );
};

export default AppLayout;
