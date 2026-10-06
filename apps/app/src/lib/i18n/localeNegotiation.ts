import { match } from '@formatjs/intl-localematcher';
import type { CookieOptions } from '@op/supabase/lib';
import { parse as parseCookies } from 'cookie';
import Negotiator from 'negotiator';

import { i18nConfig } from './config';

/** The locale a visitor last browsed in. The name predates this router. */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * The supported locale that best matches the `Accept-Language` header, or
 * undefined when the header names none of them.
 */
export const getAcceptLanguageLocale = (
  acceptLanguage: string | null,
): string | undefined => {
  const languages = new Negotiator({
    headers: { 'accept-language': acceptLanguage ?? undefined },
  }).languages();

  try {
    // Longest first works around formatjs/formatjs#4469.
    const ordered = [...i18nConfig.locales].sort((a, b) => b.length - a.length);
    const matched = match(languages, ordered, i18nConfig.defaultLocale);

    return i18nConfig.locales.find(
      (locale) => locale.toLowerCase() === matched.toLowerCase(),
    );
  } catch {
    // Invalid language tag
    return undefined;
  }
};

/**
 * Where to send a request whose path carries no locale: the locale cookie
 * first, then `Accept-Language`, then the default — the order the visitor's
 * own choices outrank the browser's.
 *
 * Returns undefined for a path that can't be decoded, which is left to 404.
 */
export const getLocaleRedirect = (
  request: Request,
):
  | {
      location: string;
      cookies: Array<{ name: string; value: string; options: CookieOptions }>;
    }
  | undefined => {
  const url = new URL(request.url);
  let pathname: string;

  try {
    // Resolve encoded characters (e.g. /%E7%B4%84 → /約) before matching.
    pathname = decodeURI(url.pathname);
  } catch {
    return undefined;
  }

  // Neutralise backslashes and repeated slashes, which a browser would read
  // as a protocol-relative URL — an open redirect.
  pathname = pathname.replace(/\\/g, '%5C').replace(/\/+/g, '/');

  const cookieLocale = parseCookies(request.headers.get('cookie') ?? '')[
    LOCALE_COOKIE_NAME
  ];
  const acceptLanguageLocale = getAcceptLanguageLocale(
    request.headers.get('accept-language'),
  );
  const locale =
    i18nConfig.locales.find((supported) => supported === cookieLocale) ??
    acceptLanguageLocale ??
    i18nConfig.defaultLocale;

  const unprefixed = pathname === '/' ? '' : pathname.replace(/\/$/, '');
  const target = new URL(`/${locale}${unprefixed}${url.search}`, url);

  // Learn the locale we picked unless the browser's header would pick it again.
  const shouldSetCookie =
    cookieLocale !== undefined
      ? cookieLocale !== locale
      : acceptLanguageLocale !== locale;

  return {
    location: target.toString(),
    cookies: shouldSetCookie
      ? [
          {
            name: LOCALE_COOKIE_NAME,
            value: locale,
            options: { path: '/', sameSite: 'lax' },
          },
        ]
      : [],
  };
};
