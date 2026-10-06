import { getRequestCspNonce } from '@/server/requestState';
import { SUPPORTED_LOCALES } from '@op/common/locales';
import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';

import { RouteError } from '@/components/RouteError';
import PageNotFound from '@/components/screens/PageNotFound';

import { routeTree } from './routeTree.gen';

// Decision-process slugs exposed at the vanity URL `/{locale}/<slug>`, which
// resolves to the same page as `/{locale}/decisions/<slug>`. Keep this list
// narrow — each entry must match the `slug` column on a public DECISION
// profile. Add a new entry only when a process is going live on its vanity
// path.
const VANITY_DECISION_SLUGS = ['columbus'];

const LOCALES = SUPPORTED_LOCALES.join('|');
const SLUGS = VANITY_DECISION_SLUGS.join('|');
const VANITY_PATH = new RegExp(`^/(${LOCALES})/(${SLUGS})(/.*)?$`);
const VANITY_TARGET = new RegExp(`^/(${LOCALES})/decisions/(${SLUGS})(/.*)?$`);

/** Server-only: the nonce the request middleware put in this request's CSP. */
const getCspNonce = createIsomorphicFn()
  .server(() => getRequestCspNonce())
  .client(() => undefined);

export function getRouter() {
  const nonce = getCspNonce();

  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Query values stay strings, as `URLSearchParams` reads them, rather than
    // being parsed as JSON — `?id=123` is "123", not 123.
    parseSearch: parseSearchWith((value) => value),
    stringifySearch: stringifySearchWith((value) =>
      typeof value === 'string' ? value : JSON.stringify(value),
    ),
    // Loading states show the moment a navigation starts.
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: PageNotFound,
    // The router renders the decision page at the vanity URL, and links to
    // the decision show the vanity URL, so the address bar never flips
    // between the two.
    rewrite: {
      input: ({ url }) => {
        const match = url.pathname.match(VANITY_PATH);

        if (!match) {
          return undefined;
        }

        const [, locale, slug, rest = ''] = match;
        url.pathname = `/${locale}/decisions/${slug}${rest}`;

        return url;
      },
      output: ({ url }) => {
        const match = url.pathname.match(VANITY_TARGET);

        if (!match) {
          return undefined;
        }

        const [, locale, slug, rest = ''] = match;
        url.pathname = `/${locale}/${slug}${rest}`;

        return url;
      },
    },
    ...(nonce ? { ssr: { nonce } } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
