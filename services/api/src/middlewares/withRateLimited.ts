import { TRPCError } from '@trpc/server';

import rateLimited from '../lib/rateLimited';
import type { MiddlewareBuilderBase } from '../types';

const withRateLimited = (opts = { windowSize: 10, maxRequests: 10 }) => {
  const withRateLimitedInner: MiddlewareBuilderBase = async ({ ctx, next }) => {
    if (!ctx.ip) {
      throw new TRPCError({
        message: `Unable to detect IP address. If you're using a VPN, disable it and try again.`,
        code: 'UNAUTHORIZED',
      });
    }

    if (!ctx.reqUrl) {
      throw new TRPCError({
        message: `Bad request. Please try again.`,
        code: 'BAD_REQUEST',
      });
    }

    const isRateLimited = rateLimited(
      ctx.ip,
      ctx.reqUrl,
      opts.windowSize,
      opts.maxRequests,
    );

    if (isRateLimited.status) {
      throw new TRPCError({
        message: `Too many requests. Please try again in ${Math.round(isRateLimited.timeToRefresh / 1000)} seconds.`,
        code: 'TOO_MANY_REQUESTS',
      });
    }

    return next({
      ctx,
    });
  };

  return withRateLimitedInner;
};

export default withRateLimited;
