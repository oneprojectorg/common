import { isTransientConnectionError } from '@op/db/errors';

import type {
  MiddlewareBuilderBeforeAfter,
  TContextWithLogger,
} from '../types';

/**
 * One replay — enough to survive a single reaped socket, few enough that a
 * genuine database outage is not amplified by the whole API retrying it.
 */
const MAX_ATTEMPTS = 2;

/**
 * Replays a query once when it died on a dropped database socket.
 *
 * A pooled Supavisor connection can be closed underneath an in-flight
 * statement, which postgres-js surfaces as `write CONNECTION_CLOSED`. That
 * reached the caller as a 500 and took the page down, even though the statement
 * never ran and a second attempt lands on a fresh socket.
 *
 * Only queries are replayed. A mutation that died on the socket may still have
 * committed, so re-running it is not safe.
 *
 * Must run after {@link withLogger} (it reports the retry through `ctx.logger`)
 * and before the middlewares that read the database, so an auth lookup that
 * loses the same socket is covered too.
 */
const withTransientRetry: MiddlewareBuilderBeforeAfter<
  TContextWithLogger
> = async ({ ctx, next, type }) => {
  let result = await next({ ctx });

  if (type !== 'query') {
    return result;
  }

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    if (result.ok || !isTransientConnectionError(result.error)) {
      return result;
    }

    ctx.logger.warn('Retrying query after a dropped database connection', {
      attempt,
      error: result.error,
    });

    result = await next({ ctx });
  }

  return result;
};

export default withTransientRetry;
