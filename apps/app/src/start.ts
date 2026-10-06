import { logger, transformMiddlewareRequest } from '@op/logging';
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start';
import { getRequestIP, setCookie } from '@tanstack/react-start/server';
import { waitUntil } from '@vercel/functions';

import {
  REPORTING_ENDPOINTS_HEADER,
  createNonceCspHeader,
  getStaticCspHeader,
  isStaticPolicyPath,
} from './lib/csp.mjs';
import { forbiddenErrorAdapter } from './lib/forbidden';
import { isProxiedPath, proxy, refreshSession } from './proxy';
import { isRequestForbidden, setRequestCspNonce } from './server/requestState';

/**
 * The tRPC context reads the caller's IP (rate limiting) from
 * `x-forwarded-for`. Vercel's edge always sets it; a bare Node server (local
 * dev, e2e) doesn't, so fill it from the socket — as Next's server did.
 */
const forwardedForMiddleware = createMiddleware().server(
  ({ request, next }) => {
    if (!request.headers.has('x-forwarded-for')) {
      const ip = getRequestIP();

      if (ip) {
        request.headers.set('x-forwarded-for', ip);
      }
    }

    return next();
  },
);

/**
 * Logs the request, refreshes the session and sends locale-less paths to
 * their localized URL — the work `src/proxy.ts` describes.
 */
const proxyMiddleware = createMiddleware().server(
  async ({ request, pathname, handlerType, next }) => {
    if (handlerType === 'serverFn') {
      // A server function reads the session like a page render does, so an
      // expired token must be refreshed before it runs.
      const { cookies } = await refreshSession(request);
      cookies.forEach(({ name, value, options }) =>
        setCookie(name, value, options),
      );

      return next();
    }

    if (!isProxiedPath(pathname)) {
      return next();
    }

    logger.info(...transformMiddlewareRequest(request));
    waitUntil(logger.flush());

    const outcome = await proxy(request);

    if (outcome.type === 'respond') {
      return outcome.response;
    }

    outcome.cookies.forEach(({ name, value, options }) =>
      setCookie(name, value, options),
    );

    return next();
  },
);

/**
 * One Content-Security-Policy per page: a fresh nonce, which the router stamps
 * on every script it renders (see `getRouter`), or the static policy for the
 * routes that never get one. API responses carry none.
 */
const contentSecurityPolicyMiddleware = createMiddleware().server(
  async ({ request, pathname, handlerType, next }) => {
    if (handlerType !== 'router' || isApiPath(pathname)) {
      return next();
    }

    if (isStaticPolicyPath(pathname)) {
      const policy = getStaticCspHeader();
      const result = await next();

      return withHeaders(result.response, { [policy.key]: policy.value });
    }

    const policy = createNonceCspHeader();
    setRequestCspNonce(request, policy.nonce);
    const result = await next();

    return withHeaders(result.response, { [policy.key]: policy.value });
  },
);

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // geolocation=(self): the proposal location picker's "Use my location"
  // button calls navigator.geolocation.getCurrentPosition. Locking it to ()
  // disables geolocation for our own origin too.
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  // Names the report-to group both policies reference.
  'Reporting-Endpoints': REPORTING_ENDPOINTS_HEADER,
};

/**
 * Everything except /api/embeds/*: that route proxies iframely's embed
 * document, which <LinkPreview> frames same-origin, so a global
 * X-Frame-Options: DENY / frame-ancestors 'none' — both of which deny
 * same-origin framing too — would blank out every link-preview embed. The
 * route sets its own sandbox CSP instead.
 */
const securityHeadersMiddleware = createMiddleware().server(
  async ({ pathname, next }) => {
    const result = await next();

    if (pathname.startsWith('/api/embeds')) {
      return result;
    }

    return withHeaders(result.response, SECURITY_HEADERS);
  },
);

/**
 * A page render that hit `forbidden()` renders the no-access screen; the
 * router only knows 200, 404 and 500, so the status is corrected here. Only
 * HTML is corrected: a server route that reached `forbidden()` on the way to a
 * fallback (the OG card) answers for itself.
 */
const forbiddenStatusMiddleware = createMiddleware().server(
  async ({ request, handlerType, next }) => {
    const result = await next();

    const isPage =
      result.response.headers.get('content-type')?.startsWith('text/html') ??
      false;

    if (handlerType !== 'router' || !isPage || !isRequestForbidden(request)) {
      return result;
    }

    return new Response(result.response.body, {
      status: 403,
      headers: result.response.headers,
    });
  },
);

/**
 * Sets headers on a response, copying it first when its headers are immutable
 * (as on a `Response.redirect()`).
 */
const withHeaders = (
  response: Response,
  headers: Record<string, string>,
): Response => {
  try {
    for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value);
    }

    return response;
  } catch {
    const copy = new Response(response.body, response);

    for (const [name, value] of Object.entries(headers)) {
      copy.headers.set(name, value);
    }

    return copy;
  }
};

const isApiPath = (pathname: string) =>
  pathname === '/api' || pathname.startsWith('/api/');

export const startInstance = createStart(() => ({
  serializationAdapters: [forbiddenErrorAdapter],
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === 'serverFn',
    }),
    securityHeadersMiddleware,
    contentSecurityPolicyMiddleware,
    forbiddenStatusMiddleware,
    forwardedForMiddleware,
    proxyMiddleware,
  ],
}));
