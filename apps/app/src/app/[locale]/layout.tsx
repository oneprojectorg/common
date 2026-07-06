import { setupSSR } from '@/utils/setupSSR';
import { getMessages } from 'next-intl/server';

import { I18nProvider } from '@/lib/i18n';

import { LocaleDirSync } from '@/components/LocaleDirSync';
import { ReactAriaRouterProvider } from '@/components/ReactAriaRouterProvider';

const AppLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) => {
  // Must be awaited: setupSSR calls notFound() for an unknown locale (e.g. a
  // bogus top-level path like /info.php resolves the [locale] segment to
  // "info.php"). Without awaiting, execution falls through to getMessages()
  // below and throws → a 500 instead of the intended 404.
  await setupSSR({ params });
  const { locale } = await params;

  const messages = await getMessages({ locale });

  return (
    <I18nProvider locale={locale} messages={messages}>
      <LocaleDirSync />
      <ReactAriaRouterProvider>{children}</ReactAriaRouterProvider>
    </I18nProvider>
  );
};

export default AppLayout;
