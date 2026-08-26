import { logger } from '@op/logging';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestContextWithSession } from '../test/supabase-utils';
import {
  commonProcedure,
  createCallerFactory,
  openProcedure,
  router,
} from '../trpcFactory';

/**
 * Drives the replay through the REAL procedure chain rather than a hand-mocked
 * `next`, so these tests fail if `withTransientRetry` is unregistered, moved to
 * a different position in `trpcFactory`, or stops recognising the result shape
 * tRPC actually produces.
 *
 * The unit tests next door cover the middleware's own branches; this file only
 * covers what mocking `next` cannot see.
 */

/** postgres-js's shape for a pooled socket that died mid-statement. */
const droppedSocketError = () =>
  Object.assign(
    new Error('write CONNECTION_CLOSED pooler.example.invalid:6543'),
    { code: 'CONNECTION_CLOSED' },
  );

/** Loses the socket on the first call the way a reaped connection does. */
function losesTheSocketOnce() {
  let calls = 0;
  return vi.fn(async () => {
    calls += 1;
    if (calls === 1) {
      throw droppedSocketError();
    }
    return 'proposal';
  });
}

/** An anonymous request context; these tests never depend on a caller. */
const testContext = () => createTestContextWithSession(null);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('withTransientRetry — through the real procedure chain', () => {
  it('replays a query built from a procedure factory, not just commonProcedure', async () => {
    // openProcedure() is what production endpoints are built from; this fails
    // if the retry is ever moved out of `commonProcedure` into some subset of
    // the four factories.
    const resolve = losesTheSocketOnce();
    const caller = createCallerFactory(
      router({ flakyQuery: openProcedure().query(resolve) }),
    )(await testContext());

    await expect(caller.flakyQuery()).resolves.toBe('proposal');
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('does not replay a mutation that died on the socket', async () => {
    const resolve = losesTheSocketOnce();
    const caller = createCallerFactory(
      router({ flakyMutation: openProcedure().mutation(resolve) }),
    )(await testContext());

    await expect(caller.flakyMutation()).rejects.toThrow('CONNECTION_CLOSED');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('leaves a genuine query failure alone', async () => {
    const resolve = vi.fn(async () => {
      throw new Error('Proposal not found');
    });
    const caller = createCallerFactory(
      router({ missing: openProcedure().query(resolve) }),
    )(await testContext());

    await expect(caller.missing()).rejects.toThrow('Proposal not found');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('re-enters the middlewares the procedure factories append', async () => {
    // The retry has to sit ABOVE everything appended after `commonProcedure`,
    // so an auth lookup that lost the same socket is replayed with the
    // resolver. A middleware registered downstream must run on both attempts.
    const downstream = vi.fn();
    const resolve = losesTheSocketOnce();
    const caller = createCallerFactory(
      router({
        flakyQuery: commonProcedure
          .use(async ({ ctx, next }) => {
            downstream();
            return next({ ctx });
          })
          .query(resolve),
      }),
    )(await testContext());

    await expect(caller.flakyQuery()).resolves.toBe('proposal');
    expect(downstream).toHaveBeenCalledTimes(2);
  });

  it('still logs one line per request when a query is replayed', async () => {
    // The retry sits INSIDE withLogger. If it were moved outside, the first
    // attempt would emit its own error line and the request would log twice.
    const resolve = losesTheSocketOnce();
    const caller = createCallerFactory(
      router({ flakyQuery: commonProcedure.query(resolve) }),
    )(await testContext());

    await caller.flakyQuery();

    const requestLines = vi
      .mocked(logger.info)
      .mock.calls.filter(([message]) => message === 'flakyQuery OK');
    expect(requestLines).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('reports the replay through the request logger', async () => {
    const resolve = losesTheSocketOnce();
    const caller = createCallerFactory(
      router({ flakyQuery: commonProcedure.query(resolve) }),
    )(await testContext());

    await caller.flakyQuery();

    expect(logger.warn).toHaveBeenCalledWith(
      'Retrying query after a dropped database connection',
      expect.objectContaining({ path: 'flakyQuery', attempt: 1 }),
    );
  });
});
