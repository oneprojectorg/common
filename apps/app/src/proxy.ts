import {
  OPURLConfig,
  cookieOptionsDomain,
  isOnPreviewAppDomain,
} from '@op/core';
import { logger, transformMiddlewareRequest } from '@op/logging';
import { createServerClient } from '@op/supabase/lib';
import createMiddleware from 'next-intl/middleware';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

import { i18nConfig, routing } from './lib/i18n';
import { PROXY_MATCHER_PATTERN } from './proxyMatcher';

const useUrl = OPURLConfig('APP');

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Log request
  logger.info(...transformMiddlewareRequest(request));

  event.waitUntil(logger.flush());
  // i18n ROUTING
  const pathname = request.nextUrl.pathname;

  // Expose the current path to Server Components (Next doesn't surface it to
  // layouts otherwise) so the walled-garden gate can build /login?redirect=...
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const pathnameIsMissingLocale = i18nConfig.locales.every(
    (locale) =>
      !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`,
  );

  // Set locale cookie if URL contains a locale (for preference learning)
  let localeResponse: NextResponse | null = null;
  if (!pathnameIsMissingLocale && !pathname.startsWith('/api')) {
    const currentLocale = i18nConfig.locales.find(
      (locale) =>
        pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
    );

    if (currentLocale) {
      const existingLocaleCookie = request.cookies.get('NEXT_LOCALE')?.value;

      // Only set cookie if it's different from current cookie value
      if (existingLocaleCookie !== currentLocale) {
        localeResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });

        // Set the locale cookie with proper domain options
        // Skip domain on preview URLs (use host-only cookies)
        const shouldSetCookieDomain =
          (useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW) &&
          !isOnPreviewAppDomain;
        localeResponse.cookies.set('NEXT_LOCALE', currentLocale, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365, // 1 year
          secure:
            useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW,
          sameSite: 'lax',
          ...(shouldSetCookieDomain ? { domain: cookieOptionsDomain } : {}),
        });
      }
    }
  }

  let supabaseResponse =
    localeResponse ||
    NextResponse.next({
      request: { headers: requestHeaders },
    });
  // Skip domain on preview URLs (use host-only cookies)
  const shouldSetCookieDomain =
    (useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW) &&
    !isOnPreviewAppDomain;
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
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          //   cookiesToSet.forEach(({ name, value, _options }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // only reroute if logged in and locale is missing. Otherwise we want to use the domain routing
  if (user && pathnameIsMissingLocale && !pathname.startsWith('/api')) {
    const handleI18nRouting = createMiddleware(routing);

    const response = handleI18nRouting(request);

    // Forward Supabase auth cookies (e.g. refreshed tokens) to the redirect
    // response. Without this, a token refresh during the redirect drops the new
    // refresh token — the browser retries with the stale one, gets a 400, and
    // loops indefinitely (most visible on Safari).
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    return response;
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  return supabaseResponse;
}

export const config = {
  matcher: [PROXY_MATCHER_PATTERN],
};
