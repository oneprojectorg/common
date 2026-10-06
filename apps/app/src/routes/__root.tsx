import { getRootRequestData } from '@/server/root.functions';
import roboto from '@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2?url';
import robotoSerifLight from '@fontsource/roboto-serif/files/roboto-serif-latin-300-normal.woff2?url';
import robotoSerif from '@fontsource/roboto-serif/files/roboto-serif-latin-400-normal.woff2?url';
import { TRPCProvider } from '@op/api/client';
import { APP_NAME, OPURLConfig, printNFO } from '@op/core';
import { DirectionProvider } from '@op/sense/Direction';
import { Toaster } from '@op/sense/Toast';
import { TooltipProvider } from '@op/sense/Tooltip';
import appCss from '@op/styles?url';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  HeadContent,
  Scripts,
  createRootRoute,
  rootRouteId,
  useMatch,
} from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import type { ReactNode } from 'react';

import { I18nProvider } from '@/lib/i18n';
import {
  findPathLocale,
  getLocaleDirection,
  i18nConfig,
} from '@/lib/i18n/config';
import { loadMessages } from '@/lib/i18n/messages';

import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { FileDropGuard } from '@/components/FileDropGuard';
import { IconProvider } from '@/components/IconProvider';
import { OTelBrowserProvider } from '@/components/OTelBrowserProvider';
import { PostHogProvider } from '@/components/PostHogProvider';
import { QueryInvalidationSubscriber } from '@/components/QueryInvalidationSubscriber';

import fontsCss from '@/styles/fonts.css?url';

const DESCRIPTION =
  'Connecting people, organizations, and resources to coordinate and grow economic democracy to global scale.';

const appUrl = OPURLConfig('APP').ENV_URL;

export const Route = createRootRoute({
  // The locale comes from the URL, so a page outside `/$locale` (login, legal
  // pages) renders in the default one.
  beforeLoad: async ({ location }) => {
    const locale =
      findPathLocale(location.pathname) ?? i18nConfig.defaultLocale;

    return { locale, messages: await loadMessages(locale) };
  },
  loader: () => getRootRequestData(),
  // Request data is fixed for the visit; `router.invalidate()` still reloads it.
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: APP_NAME },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: APP_NAME },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: `${appUrl}/LinkPreview.jpeg` },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'googlebot', content: 'noindex, nofollow' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: fontsCss },
      { rel: 'icon', href: '/op.png', type: 'image/png' },
      ...[roboto, robotoSerifLight, robotoSerif].map((href) => ({
        rel: 'preload',
        href,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous' as const,
      })),
    ],
    scripts: [{ children: printNFO() }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale, messages } = Route.useRouteContext();
  const requestData = useMatch({
    from: rootRouteId,
    select: (match) => match.loaderData,
  });
  const dir = getLocaleDirection(locale);

  return (
    <html lang={locale} dir={dir} className="h-full">
      <head>
        <HeadContent />
      </head>
      <body className="font-variables h-full overflow-x-hidden text-base text-foreground antialiased">
        <TRPCProvider>
          <QueryInvalidationSubscriber />
          <FileDropGuard />
          {/* base-ui reads direction from this context and nowhere else — its
              `useDirection` falls back to 'ltr', so `dir` on <html> alone left
              every select, menu, combobox, accordion, scroll area and slider
              navigating and positioning as if the page were LTR. */}
          <DirectionProvider direction={dir}>
            <I18nProvider locale={locale} messages={messages}>
              <OTelBrowserProvider>
                <PostHogProvider
                  consentRequired={requestData?.consentRequired ?? true}
                >
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
                  <CookieConsentBanner />
                </PostHogProvider>
              </OTelBrowserProvider>
            </I18nProvider>
            <ReactQueryDevtools initialIsOpen={false} />
            <Toaster />
          </DirectionProvider>
        </TRPCProvider>
        <Scripts />
      </body>
    </html>
  );
}
