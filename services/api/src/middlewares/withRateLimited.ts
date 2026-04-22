import { RateLimitError, UnauthorizedError, ValidationError } from '@op/common';

import rateLimited from '../lib/rateLimited';
import type { MiddlewareBuilderBase } from '../types';

const withRateLimited = (opts = { windowSize: 10, maxRequests: 10 }) => {
  const withRateLimitedInner: MiddlewareBuilderBase = async ({ ctx, next }) => {
    // Skip rate limiting for server-side calls since they are trusted
    if (ctx.isServerSideCall) {
      return next({ ctx });
    }

    if (!ctx.ip) {
      throw new UnauthorizedError(
        `Unable to detect IP address. If you're using a VPN, disable it and try again.`,
      );
    }

    if (!ctx.reqUrl) {
      throw new ValidationError('Bad request. Please try again.');
    }

    const isRateLimited = rateLimited(
      ctx.ip,
      ctx.reqUrl,
      opts.windowSize,
      opts.maxRequests,
    );

    if (isRateLimited.status) {
      const retryAfterSeconds = Math.round(isRateLimited.timeToRefresh / 1000);
      throw new RateLimitError(
        `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
      );
    }

    return next({
      ctx,
    });
  };

  return withRateLimitedInner;
};

export default withRateLimited;
