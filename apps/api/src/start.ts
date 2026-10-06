import { OPURLConfig, originUrlMatcher } from '@op/core';
import { logger, transformMiddlewareRequest } from '@op/logging';
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start';
import { getRequestIP } from '@tanstack/react-start/server';
import { waitUntil } from '@vercel/functions';

const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  //   'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers':
    'x-mutation-channels, x-query-channels, x-request-id',
};

const { IS_DEVELOPMENT } = OPURLConfig('API');

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
 * Logs every `/api` request and answers CORS for it. A preflight is answered
 * here and never reaches the route. On every other response these headers
 * take precedence over any the route set itself — the channel headers in
 * `Access-Control-Expose-Headers` are what the app's realtime invalidation
 * reads.
 */
const corsMiddleware = createMiddleware().server(
  async ({ request, pathname, next }) => {
    if (pathname !== '/api' && !pathname.startsWith('/api/')) {
      return next();
    }

    logger.info(...transformMiddlewareRequest(request));

    waitUntil(logger.flush());
    // Check the origin from the request
    const origin = request.headers.get('origin') ?? '';
    const isAllowedOrigin = IS_DEVELOPMENT
      ? true
      : origin.match(originUrlMatcher)?.length;

    // Handle preflighted requests
    const isPreflight = request.method === 'OPTIONS';

    if (isPreflight) {
      const preflightHeaders = {
        ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
        ...corsOptions,
        'Access-Control-Allow-Headers':
          request.headers.get('access-control-request-headers') || '',
      };

      return Response.json({}, { headers: preflightHeaders });
    }

    // Handle simple requests
    const result = await next();

    return withHeaders(result.response, {
      ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      ...corsOptions,
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') || '',
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

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === 'serverFn',
    }),
    forwardedForMiddleware,
    corsMiddleware,
  ],
}));
