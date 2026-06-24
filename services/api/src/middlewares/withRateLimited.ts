import { consumeSlidingWindow } from '@op/cache';
import { RateLimitError, UnauthorizedError, ValidationError } from '@op/common';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContext } from '../types';

interface RateLimitOptions {
  /** Window width in seconds (preserved from the in-memory implementation). */
  windowSize: number;
  /** Maximum hits within the window before further calls are rejected. */
  maxRequests: number;
}

const withRateLimited = (
  opts: RateLimitOptions = { windowSize: 10, maxRequests: 10 },
) => {
  const withRateLimitedInner: MiddlewareBuilderBase = async ({ ctx, next }) => {
    // Trusted server-side calls and E2E (bursty test traffic) bypass rate limits.
    if (
      ctx.isServerSideCall ||
      process.env.E2E ||
      process.env.TEMP_DISABLE_RATE_LIMITING
    ) {
      return next({ ctx });
    }

    if (!ctx.reqUrl) {
      throw new ValidationError('Bad request. Please try again.');
    }

    // Prefer the authenticated user's id when present so a caller can't
    // bypass the limit by rotating client IPs from behind the same session.
    // `getCachedAuthUser` is `WeakMap`-cached per ctx, so downstream auth
    // gates pay no extra cost when we resolve here. Fall back to the
    // safely-parsed client IP when there's no session (e.g. login OTP);
    // refuse to limit on a missing identity — unbucketed traffic would
    // silently fail-open the way the in-memory predecessor did.
    const userId = await resolveUserId(ctx);
    const identityKey = userId ?? ctx.ip;
    if (!identityKey) {
      throw new UnauthorizedError(
        `Unable to detect IP address. If you're using a VPN, disable it and try again.`,
      );
    }

    const result = await consumeSlidingWindow({
      key: `rl:${identityKey}:${ctx.reqUrl}`,
      windowMs: opts.windowSize * 1_000,
      maxRequests: opts.maxRequests,
    });

    if (!result.allowed) {
      throw new RateLimitError();
    }

    return next({ ctx });
  };

  return withRateLimitedInner;
};

const resolveUserId = async (ctx: TContext): Promise<string | null> => {
  try {
    const response = await getCachedAuthUser(ctx);
    return response.error ? null : (response.data.user?.id ?? null);
  } catch {
    return null;
  }
};

export default withRateLimited;
