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
import withRequireUser from './middlewares/withRequireUser';
import withResolveUser from './middlewares/withResolveUser';
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
export const commonProcedure = t.procedure.use(withChannelMeta).use(withLogger);

export const DEFAULT_RATE_LIMIT = { windowSize: 10, maxRequests: 10 };

interface CommonProcedureOptions {
  rateLimit?: {
    windowSize: number;
    maxRequests: number;
  };
}

/**
 * Closed-network procedure: only real authed users on the allow-list (or
 * `@oneproject.org`) pass. Sets `ctx.user`. Use for endpoints that
 * remain gated to the closed-network audience.
 *
 * Includes: channelMeta -> logger -> rateLimited -> networkAuthentication -> analytics
 */
export function commonNetworkProcedure(opts?: CommonProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withNetworkAuthentication)
    .use(withAnalytics);
}

/**
 * Authenticated procedure: admits real authed users **and** anon-JWT
 * callers. Rejects no-JWT callers. Sets `ctx.user` (always defined).
 * Authorization is delegated to the service layer — `getProfileAccessUser`
 * / `getOrgAccessUser` substitute the GLOBAL_USER_ANONYMOUS sentinel for
 * anon callers when resolving role grants.
 *
 * Includes: channelMeta -> logger -> rateLimited -> resolveUser -> requireUser -> analytics
 */
export function authenticatedProcedure(opts?: CommonProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withResolveUser)
    .use(withRequireUser)
    .use(withAnalytics);
}

/**
 * Open procedure: admits real authed users, anon-JWT callers, **and**
 * no-JWT callers. Sets `ctx.user?` — possibly undefined. Authorization
 * is delegated to the service layer — `getProfileAccessUser` /
 * `getOrgAccessUser` substitute GLOBAL_USER_PUBLIC for no-JWT and
 * GLOBAL_USER_ANONYMOUS for anon-JWT when resolving role grants.
 *
 * Routers using this procedure should still gate at the boundary for
 * writes that require a real Supabase user.
 *
 * Includes: channelMeta -> logger -> rateLimited -> resolveUser -> analytics
 */
export function openProcedure(opts?: CommonProcedureOptions) {
  const rateLimit = opts?.rateLimit ?? DEFAULT_RATE_LIMIT;
  return commonProcedure
    .use(withRateLimited(rateLimit))
    .use(withResolveUser)
    .use(withAnalytics);
}
