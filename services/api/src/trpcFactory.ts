import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { customAlphabet } from 'nanoid';
import superjson from 'superjson';

import {
  getCookie as _getCookie,
  getCookies as _getCookies,
  setCookie as _setCookie,
} from './lib/cookies';
import { errorFormatter } from './lib/error';
import withAnalytics from './middlewares/withAnalytics';
import withChannelMeta from './middlewares/withChannelMeta';
import withLogger from './middlewares/withLogger';
import withNetworkAuthentication from './middlewares/withNetworkAuthentication';
import withRateLimited from './middlewares/withRateLimited';
import withRequestCache from './middlewares/withRequestCache';
import withRequireUser from './middlewares/withRequireUser';
import withResolvedUser from './middlewares/withResolvedUser';
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

const t = initTRPC.context<TContext>().create({
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
export const commonProcedure = t.procedure
  .use(withRequestCache)
  .use(withChannelMeta)
  .use(withLogger);

const DEFAULT_RATE_LIMIT = { windowSize: 10, maxRequests: 10 };

interface RateLimitedProcedureOptions {
  rateLimit?: {
    windowSize: number;
    maxRequests: number;
  };
}

/**
 * Closed-network authenticated procedure (formerly `commonAuthedProcedure`).
 * Includes: requestCache -> channelMeta -> logger -> rateLimited ->
 * networkAuthentication -> analytics.
 *
 * Rejects anonymous and unauthenticated callers at the auth gate and admits
 * only confirmed `@oneproject.org` / allow-listed users. Use this for endpoints
 * that genuinely require closed-network membership.
 *
 * @param opts.rateLimit - Custom rate limit config (default: 10 requests per 10 seconds)
 *
 * Usage:
 * - `commonNetworkProcedure()` - uses default rate limit (10 req/10s)
 * - `commonNetworkProcedure({ rateLimit: { windowSize: 60, maxRequests: 5 } })` - custom rate limit
 */
export function commonNetworkProcedure(opts?: RateLimitedProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withNetworkAuthentication)
    .use(withAnalytics);
}

/**
 * Authenticated procedure for any real Supabase user — including anonymous
 * sign-ins. Includes: requestCache -> channelMeta -> logger -> rateLimited ->
 * resolvedUser -> requireUser -> analytics.
 *
 * Requires *a* user but performs no closed-network gating; authorization is
 * deferred to the service layer. Endpoints move here from
 * `commonNetworkProcedure` once gating tests prove anon / out-of-network
 * callers still fail closed (or are intentionally admitted).
 *
 * @param opts.rateLimit - Custom rate limit config (default: 10 requests per 10 seconds)
 */
export function authenticatedProcedure(opts?: RateLimitedProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withResolvedUser)
    .use(withRequireUser)
    .use(withAnalytics);
}

/**
 * Open procedure for no-JWT / public-capable endpoints. Includes: requestCache
 * -> channelMeta -> logger -> rateLimited -> resolvedUser -> analytics.
 *
 * Resolves an optional user (`ctx.user?`) but never rejects at the middleware
 * layer — authorization is fully the service layer's responsibility. Used by
 * nothing yet; endpoints opt in only once their service layer does real role
 * checks and has updated gating coverage.
 *
 * @param opts.rateLimit - Custom rate limit config (default: 10 requests per 10 seconds)
 */
export function openProcedure(opts?: RateLimitedProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withResolvedUser)
    .use(withAnalytics);
}
