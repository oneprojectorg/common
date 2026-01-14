import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { customAlphabet } from 'nanoid';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  getCookie as _getCookie,
  getCookies as _getCookies,
  setCookie as _setCookie,
} from './lib/cookies';
import { errorFormatter } from './lib/error';
import withAnalytics from './middlewares/withAnalytics';
import withAuthenticated from './middlewares/withAuthenticated';
import withChannelMeta from './middlewares/withChannelMeta';
import withLogger from './middlewares/withLogger';
import withRateLimited from './middlewares/withRateLimited';
import type { TContext } from './types';

export const createContext = async ({
  req,
  resHeaders,
}: FetchCreateContextFnOptions): Promise<TContext> => {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

  // seperate in 4-8-8-4 xxxx-xxxxxxxx-xxxxxxxx-xxxx
  const requestId = [
    nanoid().slice(0, 4),
    nanoid().slice(4, 12),
    nanoid().slice(12, 20),
    nanoid().slice(20, 24),
  ].join('-');

  resHeaders.set('x-request-id', requestId);

  return {
    getCookies: () => _getCookies(req),
    getCookie: (name) => _getCookie(req, name),
    setCookie: ({ name, value, options }) =>
      _setCookie({ resHeaders, name, value, options }),
    // These are overridden by withChannelMeta middleware for actual channel handling
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    requestId,
    time: Date.now(),
    ip: req.headers.get('X-Forwarded-For') || null,
    reqUrl: req.url,
    req,
  };
};

const t = initTRPC
  .meta<OpenApiMeta>()
  .context<TContext>()
  .create({
    errorFormatter,
    transformer: superjson,
    experimental: {
      iterablesAndDeferreds: true,
    },
  });

export const { router } = t;
export const { middleware } = t;
export const { mergeRouters } = t;
export const createCallerFactory = t.createCallerFactory;
export const commonProcedure = t.procedure.use(withChannelMeta).use(withLogger);

const DEFAULT_RATE_LIMIT = { windowSize: 10, maxRequests: 10 };

interface CommonAuthedProcedureOptions {
  rateLimit?: {
    windowSize: number;
    maxRequests: number;
  };
}

/**
 * Creates an authenticated procedure with configurable rate limiting.
 * Includes: channelMeta -> logger -> rateLimited -> authenticated -> analytics
 *
 * @param opts.rateLimit - Custom rate limit config (default: 10 requests per 10 seconds)
 *
 * Usage:
 * - `commonAuthedProcedure()` - uses default rate limit (10 req/10s)
 * - `commonAuthedProcedure({ rateLimit: { windowSize: 60, maxRequests: 5 } })` - custom rate limit
 *
 * For unauthenticated endpoints, use `commonProcedure` with explicit middleware.
 */
export function commonAuthedProcedure(opts?: CommonAuthedProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withAuthenticated)
    .use(withAnalytics);
}
