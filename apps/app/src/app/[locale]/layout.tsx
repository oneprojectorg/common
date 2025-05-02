import { setupSSR } from '@/utils/setupSSR';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

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
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
};

export default AppLayout;
