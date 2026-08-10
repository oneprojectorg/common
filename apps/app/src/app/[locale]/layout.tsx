import { setupSSR } from '@/utils/setupSSR';
import { DirectionProvider } from '@op/sense/Direction';
import { getMessages } from 'next-intl/server';

import { I18nProvider } from '@/lib/i18n';
import { getLocaleDirection } from '@/lib/i18n/config';

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
      {/* The root layout sits above [locale], so its getLocale() goes stale on
          locale navigation — LocaleDirSync patches <html dir> for that, but the
          root DirectionProvider keeps serving the stale value to base-ui. Any
          component reading direction from context instead of CSS (the Sidebar's
          side, menu/select positioning, arrow-key nav) stays LTR in Arabic.
          Re-provide it here, where params.locale is authoritative. */}
      <DirectionProvider direction={getLocaleDirection(locale)}>
        <LocaleDirSync />
        <ReactAriaRouterProvider>{children}</ReactAriaRouterProvider>
      </DirectionProvider>
    </I18nProvider>
  );
};

export default AppLayout;
