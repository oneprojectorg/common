import { TRPCProvider } from '@op/api/client';
import { getSSRCookies } from '@op/api/ssrCookies';
import { APP_NAME, OPURLConfig, printNFO } from '@op/core';
import '@op/styles';
import { DirectionProvider } from '@op/sense/Direction';
import { Toaster } from '@op/sense/Toast';
import { TooltipProvider } from '@op/sense/Tooltip';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { Metadata, Viewport } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import { Roboto, Roboto_Serif } from 'next/font/google';
import Script from 'next/script';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { IconProvider } from '@/components/IconProvider';

import { FileDropGuard } from '../components/FileDropGuard';
import { OTelBrowserProvider } from '../components/OTelBrowserProvider';
import { PostHogProvider } from '../components/PostHogProvider';
import { QueryInvalidationSubscriber } from '../components/QueryInvalidationSubscriber';
import { I18nProvider } from '../lib/i18n';
import { getLocaleDirection } from '../lib/i18n/config';

const roboto = Roboto({
  subsets: ['latin'],
  // Load the variable font (full wght axis) so font-strong's 450 renders true
  // instead of rounding up to the nearest static cut (500). next's Roboto type
  // only accepts 'variable' here, not a range string.
  weight: 'variable',
  variable: '--font-sans',
  display: 'swap',
});

const robotoSerif = Roboto_Serif({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(OPURLConfig('APP').ENV_URL),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    'Connecting people, organizations, and resources to coordinate and grow economic democracy to global scale.',
  icons: {
    icon: [{ url: '/op.png', type: 'image/png' }],
  },
  openGraph: {
    title: APP_NAME,
    description:
      'Connecting people, organizations, and resources to coordinate and grow economic democracy to global scale.',
    images: ['/LinkPreview.jpeg'],
  },
  robots: {
    googleBot: {
      index: false,
      follow: false,
    },
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  // getMessages() with no locale argument shares getLocale()'s memoized
  // request config, so all three can resolve in parallel.
  const [ssrCookies, locale, messages] = await Promise.all([
    getSSRCookies(),
    getLocale(),
    getMessages(),
  ]);
  const dir = getLocaleDirection(locale);

  return (
    <html lang={locale} dir={dir} className="h-full">
      <head>
        <Script id="nfo-script" strategy="beforeInteractive">
          {printNFO()}
        </Script>
      </head>
      <TRPCProvider ssrCookies={ssrCookies}>
        <QueryInvalidationSubscriber />
        <body
          className={`${roboto.variable} ${robotoSerif.variable} h-full overflow-x-hidden text-base text-foreground antialiased`}
        >
          <FileDropGuard />
          {/* base-ui reads direction from this context and nowhere else — its
              `useDirection` falls back to 'ltr', so `dir` on <html> alone left
              every select, menu, combobox, accordion, scroll area and slider
              navigating and positioning as if the page were LTR. */}
          <DirectionProvider direction={dir}>
            <I18nProvider locale={locale} messages={messages}>
              <OTelBrowserProvider>
                <PostHogProvider>
                  <NuqsAdapter>
                    {/* base-ui's tooltip Provider is the grouping primitive, not
                        just a delay carrier: it keeps one tooltip open at a time
                        and skips the delay while moving between triggers in the
                        same group. One at the root gives the whole app a single
                        group; nest another only to give a set of triggers its own
                        delay (`delay` exists on Provider alone). */}
                    <TooltipProvider>
                      <IconProvider>{children}</IconProvider>
                    </TooltipProvider>
                  </NuqsAdapter>
                </PostHogProvider>
              </OTelBrowserProvider>
            </I18nProvider>
            <ReactQueryDevtools initialIsOpen={false} />
            <Toaster />
          </DirectionProvider>
        </body>
      </TRPCProvider>
    </html>
  );
};

export default RootLayout;
