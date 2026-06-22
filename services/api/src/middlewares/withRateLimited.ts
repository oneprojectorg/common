import { RateLimitError, UnauthorizedError, ValidationError } from '@op/common';

import rateLimited from '../lib/rateLimited';
import type { MiddlewareBuilderBase } from '../types';

const withRateLimited = (opts = { windowSize: 10, maxRequests: 10 }) => {
  const withRateLimitedInner: MiddlewareBuilderBase = async ({ ctx, next }) => {
    // Trusted server-side calls and E2E (bursty test traffic) bypass rate limits.
    //
    // TEMP_DISABLE_RATE_LIMITING is a temporary load-testing toggle. Unlike E2E
    // (which ALSO clamps the Postgres pool to max:1 in services/db, crippling any
    // capacity measurement), this flag bypasses ONLY the limiter, leaving the
    // prod-like pool intact. Remove this once load testing is done — left enabled
    // it disables rate limiting entirely.
    if (
      ctx.isServerSideCall ||
      process.env.E2E ||
      process.env.TEMP_DISABLE_RATE_LIMITING === 'true'
    ) {
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
