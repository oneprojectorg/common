import { OPURLConfig, cookieOptionsDomain } from '@op/core';
import { logger, transformMiddlewareRequest } from '@op/logger';
import { createServerClient } from '@op/supabase/lib';
import createMiddleware from 'next-intl/middleware';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

import { i18nConfig, routing } from './lib/i18n';

const useUrl = OPURLConfig('APP');

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Log request
  logger.info(...transformMiddlewareRequest(request));

  event.waitUntil(logger.flush());
  // i18n ROUTING
  const pathname = request.nextUrl.pathname;
  const pathnameIsMissingLocale = i18nConfig.locales.every(
    (locale) =>
      !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`,
  );

  // only reroute if locale is missing. Otherwise we want to use the domain routing
  if (pathnameIsMissingLocale && !pathname.startsWith('/api')) {
    const handleI18nRouting = createMiddleware(routing);

    const response = handleI18nRouting(request);

    return response;
  }

  let supabaseResponse = NextResponse.next({
    request,
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions:
        useUrl.IS_PRODUCTION || useUrl.IS_STAGING || useUrl.IS_PREVIEW
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
            // eslint-disable-next-line ts/no-unsafe-argument
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

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();

    url.pathname = '/login';

    return NextResponse.redirect(url);
  }

  if (user && !user.email?.match('oneproject.org|scottcazan@gmail.com')) {
    logger.warn('Invalid user email access attempt', { email: user.email });
    supabase.auth.signOut();
    return NextResponse.redirect(new URL('/waitlist', request.url));
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
  matcher: [
    '/protected/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|ingest|api|waitlist|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
    // '/(.*rss\\.xml)',
    // '/((?!node/|auth/|_next/|_static/|_vercel|_axiom/|media/|[\\w-]+\\.\\w+|.*\\..*).*)',
  ],
};
