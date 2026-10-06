import {
  notFound as routerNotFound,
  redirect as routerRedirect,
  useLocation,
  useRouter as useTanStackRouter,
} from '@tanstack/react-router';
import { useMemo } from 'react';

export { forbidden } from './forbidden';

/**
 * Navigation by full href — locale prefix included. For app-absolute hrefs
 * that should pick up the current locale, use `useRouter` from `@/lib/i18n`.
 */
export const useRouter = () => {
  const router = useTanStackRouter();

  // `href` takes precedence over `to`, which the types require regardless.
  return useMemo(
    () => ({
      push: (href: string, options?: { scroll?: boolean }) => {
        void router.navigate({ to: '.', href, resetScroll: options?.scroll });
      },
      replace: (href: string, options?: { scroll?: boolean }) => {
        void router.navigate({
          to: '.',
          href,
          replace: true,
          resetScroll: options?.scroll,
        });
      },
      prefetch: (href: string) => {
        void router.preloadRoute({ to: '.', href }).catch(() => {});
      },
      /** Re-runs the current route's loaders. */
      refresh: () => {
        void router.invalidate();
      },
      back: () => router.history.back(),
      forward: () => router.history.forward(),
    }),
    [router],
  );
};

/** The current path, locale prefix included. */
export const usePathname = (): string =>
  useLocation({ select: (location) => location.pathname });

/** The current query string, read-only. */
export const useSearchParams = (): URLSearchParams => {
  const searchStr = useLocation({ select: (location) => location.searchStr });

  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
};

/** Renders the nearest not-found screen (a 404 on the server). */
export function notFound(): never {
  throw routerNotFound();
}

/** Sends the visitor to `href` (a 307 on the server). */
export function redirect(href: string): never {
  throw routerRedirect({ href });
}
