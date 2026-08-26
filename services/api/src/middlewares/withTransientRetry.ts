import { withRetry } from '@op/core';
import { isTransientConnectionError } from '@op/db/errors';

import type {
  MiddlewareBuilderBeforeAfter,
  TContextWithLogger,
} from '../types';

/**
 * Replays a query once when it died on a dropped database socket.
 *
 * A pooled Supavisor connection can be closed underneath an in-flight
 * statement, which postgres-js surfaces as `write CONNECTION_CLOSED`. That
 * reached the caller as a 500 and took the page down, even though the statement
 * never ran and a second attempt lands on a fresh socket.
 *
 * Must run after {@link withLogger} (it reports the retry through `ctx.logger`)
 * and before the middlewares that read the database, so an auth lookup that
 * loses the same socket is covered too.
 */
const withTransientRetry: MiddlewareBuilderBeforeAfter<
  TContextWithLogger
> = async ({ ctx, next, type }) => {
  // A mutation that died on the socket may still have committed, so it is
  // never replayed.
  if (type !== 'query') {
    return next({ ctx });
  }

  return withRetry(
    async () => {
      const result = await next({ ctx });

      // `next` reports a failed procedure instead of throwing, so re-throw the
      // transient ones — a throw is the only signal `withRetry` acts on. tRPC
      // turns the final one back into the same `{ ok: false }` result.
      if (!result.ok && isTransientConnectionError(result.error)) {
        throw result.error;
      }

      return result;
    },
    {
      retries: 1,
      // Belt and braces: today the only throw inside the callback is the one
      // above, which is already classified. Stating the predicate here keeps
      // that true if `next` ever starts rejecting instead of returning
      // `{ ok: false }` — without it, `withRetry` would default to replaying
      // every error, including the rate-limit and authorization failures raised
      // by the middlewares nested inside this one.
      shouldRetry: isTransientConnectionError,
      onRetry: (error, attempt) =>
        ctx.logger.warn('Retrying query after a dropped database connection', {
          attempt,
          error,
        }),
    },
  );
};

export default withTransientRetry;
