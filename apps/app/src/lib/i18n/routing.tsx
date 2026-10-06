import {
  redirect as routerRedirect,
  useLocation,
  useRouter as useTanStackRouter,
} from '@tanstack/react-router';
import { useMemo } from 'react';
import { useLocale } from 'use-intl';

import { i18nConfig } from './config';

export type { TranslateFn, TranslationKey } from './translate';

export const routing = {
  locales: i18nConfig.locales,
  defaultLocale: i18nConfig.defaultLocale,
};

export { useTranslations } from 'use-intl';
export { Link } from './Link';

/**
 * Prefixes an app-absolute href (`/org/acme`) with the locale. Hrefs with a
 * protocol and relative ones pass through untouched.
 */
export const localizeHref = (href: string, locale: string): string => {
  const isLocalizable = href.startsWith('/') && !/^[a-z]+:/i.test(href);

  if (!isLocalizable) {
    return href;
  }

  // `/` and `/?q=…` join the prefix without a trailing slash.
  return `/${locale}${/^\/(\?.*)?$/.test(href) ? href.slice(1) : href}`;
};

/** The current path without its locale prefix: `/en/org/acme` → `/org/acme`. */
export const usePathname = (): string => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const prefix = `/${useLocale()}`;

  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length) || '/';
  }

  return pathname;
};

interface NavigateOptions {
  /** `false` keeps the scroll position instead of returning to the top. */
  scroll?: boolean;
}

/** Navigation that takes app-absolute hrefs and adds the current locale. */
export const useRouter = () => {
  const router = useTanStackRouter();
  const locale = useLocale();

  return useMemo(
    () => ({
      push: (href: string, options?: NavigateOptions) => {
        void router.navigate({
          to: '.',
          href: localizeHref(href, locale),
          resetScroll: options?.scroll,
        });
      },
      replace: (href: string, options?: NavigateOptions) => {
        void router.navigate({
          to: '.',
          href: localizeHref(href, locale),
          replace: true,
          resetScroll: options?.scroll,
        });
      },
      prefetch: (href: string) => {
        void router
          .preloadRoute({ to: '.', href: localizeHref(href, locale) })
          .catch(() => {});
      },
      /** Re-runs the current route's loaders. */
      refresh: () => {
        void router.invalidate();
      },
      back: () => router.history.back(),
      forward: () => router.history.forward(),
    }),
    [router, locale],
  );
};

/**
 * Sends a route's loader to a localized href. Throw it from `beforeLoad` or
 * `loader`, where the router turns it into a redirect.
 */
export const redirect = ({
  href,
  locale,
}: {
  href: string;
  locale: string;
}): never => {
  throw routerRedirect({ to: '.', href: localizeHref(href, locale) });
};
