import { RateLimitError, UnauthorizedError, ValidationError } from '@op/common';

import rateLimited from '../lib/rateLimited';
import type { MiddlewareBuilderBase } from '../types';

const withRateLimited = (opts = { windowSize: 10, maxRequests: 10 }) => {
  // E2E: bursty mutation→refetch cycles in tests exhaust the per-URL counter
  // and produce flaky failures. Real users don't burst this fast. Same opt-out
  // pattern as services/db/index.ts.
  if (process.env.E2E) {
    const passthrough: MiddlewareBuilderBase = ({ ctx, next }) => next({ ctx });
    return passthrough;
  }

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
      throw new RateLimitError();
    }

    return next({
      ctx,
    });
  };

  return withRateLimitedInner;
};

export default withRateLimited;
