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
import withAuthenticatedUser from './middlewares/withAuthenticatedUser';
import withChannelMeta from './middlewares/withChannelMeta';
import withConfirmedUser from './middlewares/withConfirmedUser';
import withLogger from './middlewares/withLogger';
import withNetworkAuthenticatedUser from './middlewares/withNetworkAuthenticatedUser';
import withRateLimited from './middlewares/withRateLimited';
import withRequestCache from './middlewares/withRequestCache';
import withResolvedUser from './middlewares/withResolvedUser';
import withTransientRetry from './middlewares/withTransientRetry';
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
// `withTransientRetry` sits inside `withLogger` so a replayed query still
// produces one log line for the request, and outside everything the procedure
// factories append, so an auth lookup that loses the same database socket is
// replayed alongside the resolver.
export const commonProcedure = t.procedure
  .use(withRequestCache)
  .use(withChannelMeta)
  .use(withLogger)
  .use(withTransientRetry);

const DEFAULT_RATE_LIMIT = { windowSize: 10, maxRequests: 10 };

interface RateLimitedProcedureOptions {
  rateLimit?: {
    windowSize: number;
    maxRequests: number;
  };
}

/**
 * Closed-network procedure (formerly `commonAuthedProcedure`): admits only
 * confirmed `@oneproject.org` / allow-listed users via {@link withNetworkAuthenticatedUser}.
 * Default rate limit is 10 requests per 10 seconds.
 */
export function networkAuthenticatedProcedure(
  opts?: RateLimitedProcedureOptions,
) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withNetworkAuthenticatedUser)
    .use(withAnalytics);
}

/**
 * Confirmed-user procedure: admits any confirmed, non-anonymous user (a real
 * account whose email/phone is confirmed) via {@link withConfirmedUser}, but
 * applies no closed-network/allow-list gating. Sits one tier below
 * {@link networkAuthenticatedProcedure} (which adds the `@oneproject.org` /
 * invite allow list) and one above {@link authenticatedProcedure} (which also
 * admits anonymous sessions). Default rate limit is 10 requests per 10 seconds.
 */
export function authenticatedConfirmedProcedure(
  opts?: RateLimitedProcedureOptions,
) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withConfirmedUser)
    .use(withAnalytics);
}

/**
 * Requires *a* user (any session, including anonymous sign-ins) but does no
 * closed-network gating; authorization is deferred to the service layer.
 * Endpoints migrate here from {@link networkAuthenticatedProcedure} once gating
 * tests prove out-of-network callers still fail closed. Default rate limit is
 * 10 requests per 10 seconds.
 */
export function authenticatedProcedure(opts?: RateLimitedProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withResolvedUser)
    .use(withAuthenticatedUser)
    .use(withAnalytics);
}

/**
 * Public-capable procedure: resolves an optional `ctx.user` but never rejects
 * at the middleware layer — authorization is fully the service layer's job.
 * Default rate limit is 10 requests per 10 seconds.
 */
export function openProcedure(opts?: RateLimitedProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withResolvedUser)
    .use(withAnalytics);
}
