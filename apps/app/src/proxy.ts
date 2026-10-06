import {
  OPURLConfig,
  cookieOptionsDomain,
  isOnPreviewAppDomain,
} from '@op/core';
import { createServerClient } from '@op/supabase/lib';
import type { CookieOptions } from '@op/supabase/lib';
import { parse as parseCookies, serialize as serializeCookie } from 'cookie';

import { findPathLocale } from './lib/i18n/config';
import {
  LOCALE_COOKIE_NAME,
  getLocaleRedirect,
} from './lib/i18n/localeNegotiation';

const useUrl = OPURLConfig('APP');

// Skip the domain on preview URLs, which use host-only cookies.
const shouldSetCookieDomain =
  (useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW) &&
  !isOnPreviewAppDomain;

/**
 * Paths the proxy runs on. Every one of them triggers an auth check, so keep
 * the exclusion list broad enough to skip routes that don't need cookie
 * refresh or the locale redirect.
 *
 * Skipped path prefixes (no-auth routes):
 *   - Build output + server functions: _build, _serverFn
 *   - In-tree API + rewrites:          api, assets, stats
 *   - Public landing pages:            waitlist, info, login
 *   - SEO/monitoring files:            sitemap.xml, robots.txt,
 *                                      manifest.webmanifest, health, _health,
 *                                      favicon.ico
 * Skipped file extensions:
 *   - images: svg, png, jpg, jpeg, gif, webp, avif, ico, bmp
 *   - fonts:  woff, woff2, ttf, otf, eot
 *   - docs:   pdf
 *   - text:   json, xml, txt, html
 *   - build:  css, js, map
 *   - media:  mp4, webm, mp3, ogg, wav
 *
 * Server functions skip the proxy but still refresh the session — see
 * `refreshSession`.
 */
const PROXIED_PATH =
  /^\/(?!_build|_serverFn|api|assets|stats|waitlist|info|login|sitemap.xml|robots.txt|manifest.webmanifest|favicon.ico|health|_health|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf|eot|pdf|json|xml|txt|html|css|js|map|mp4|webm|mp3|ogg|wav)$).*$/;

export const isProxiedPath = (pathname: string) => PROXIED_PATH.test(pathname);

export interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export type ProxyOutcome =
  /** Send this response instead of rendering. */
  | { type: 'respond'; response: Response }
  /** Render the request, setting these cookies on the response. */
  | { type: 'continue'; cookies: Array<CookieToSet> };

/**
 * Refreshes the Supabase session, then sends a locale-less path to its
 * localized URL. A refreshed token is written back onto `request`, so
 * everything that reads the request's cookies after this sees the new one.
 */
export async function proxy(request: Request): Promise<ProxyOutcome> {
  const { pathname } = new URL(request.url);
  const { cookies, isAuthenticated } = await refreshSession(request);
  const currentLocale = findPathLocale(pathname);

  // Reroute when the locale prefix is missing — for both logged-in users and
  // anonymous visitors on non-root paths. Public links like `/columbus` need
  // locale detection so they resolve to `/en/columbus` and then the router's
  // vanity rewrite dispatches to the decision page. The bare root `/` is
  // preserved for anonymous visitors so `routes/index.tsx` (ComingSoonScreen)
  // keeps rendering instead of bouncing through the walled-garden gate.
  const shouldRouteI18n =
    !currentLocale && (isAuthenticated || pathname !== '/');

  if (shouldRouteI18n) {
    const redirect = getLocaleRedirect(request);

    if (redirect) {
      const headers = new Headers({ location: redirect.location });

      // Forward Supabase auth cookies (e.g. refreshed tokens) to the redirect
      // response. Without this, a token refresh during the redirect drops the
      // new refresh token — the browser retries with the stale one, gets a
      // 400, and loops indefinitely (most visible on Safari).
      for (const cookie of [...cookies, ...redirect.cookies]) {
        headers.append(
          'set-cookie',
          serializeCookie(cookie.name, cookie.value, cookie.options),
        );
      }

      return {
        type: 'respond',
        response: new Response(null, { status: 307, headers }),
      };
    }
  }

  return {
    type: 'continue',
    cookies: [
      ...cookies,
      ...getLocalePreferenceCookies(request, currentLocale),
    ],
  };
}

/**
 * Refreshes an expired Supabase session. The new tokens go out as response
 * cookies and are also written onto the request, so the render — and every
 * tRPC call it makes — sees the session the browser is about to hold rather
 * than the one it sent.
 */
export async function refreshSession(request: Request) {
  const requestCookies = new Map(
    Object.entries(parseCookies(request.headers.get('cookie') ?? '')).flatMap(
      ([name, value]) => (value === undefined ? [] : [[name, value] as const]),
    ),
  );
  const cookies: Array<CookieToSet> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: shouldSetCookieDomain
        ? {
            domain: cookieOptionsDomain,
            sameSite: 'lax',
            secure: true,
          }
        : {},
      cookies: {
        getAll() {
          return [...requestCookies].map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            requestCookies.set(cookie.name, cookie.value);
            cookies.push(cookie);
          }

          request.headers.set(
            'cookie',
            [...requestCookies]
              .map(([name, value]) => serializeCookie(name, value))
              .join('; '),
          );
        },
      },
    },
  );

  // IMPORTANT: DO NOT REMOVE. getClaims() calls _useSession() internally,
  // which refreshes expired tokens and writes them back through the cookie
  // adapter; dropping it silently logs users out.
  const { data: authData } = await supabase.auth.getClaims();

  return { cookies, isAuthenticated: Boolean(authData?.claims) };
}

/**
 * Refreshes the locale preference cookie when the URL's locale differs from
 * what the browser last sent, so the next locale-less visit lands on it.
 */
const getLocalePreferenceCookies = (
  request: Request,
  currentLocale: string | undefined,
): Array<CookieToSet> => {
  if (!currentLocale) {
    return [];
  }

  const sentLocale = parseCookies(request.headers.get('cookie') ?? '')[
    LOCALE_COOKIE_NAME
  ];

  if (sentLocale === currentLocale) {
    return [];
  }

  return [
    {
      name: LOCALE_COOKIE_NAME,
      value: currentLocale,
      options: {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        secure: useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW,
        sameSite: 'lax',
        ...(shouldSetCookieDomain ? { domain: cookieOptionsDomain } : {}),
      },
    },
  ];
};
