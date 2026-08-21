import { NotFoundError } from '@op/common';
import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

import type { TContextWithLogger } from '../types';
import withTransientRetry from './withTransientRetry';

type NextResult = { ok: true; data: unknown } | { ok: false; error: unknown };

/**
 * The shape postgres-js produces when a pooled socket dies mid-statement, as
 * tRPC hands it to a middleware: the driver error is only ever reachable
 * through the wrapping `TRPCError`'s `cause`.
 */
function droppedSocketError(): TRPCError {
  const driverError = Object.assign(
    new Error(
      'write CONNECTION_CLOSED aws-0-us-east-1.pooler.supabase.com:6543',
    ),
    { code: 'CONNECTION_CLOSED' },
  );

  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: driverError });
}

function makeLoggerContext() {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } satisfies TContextWithLogger;
}

function runRetry({
  ctx,
  type,
  results,
}: {
  ctx: TContextWithLogger;
  type: 'query' | 'mutation';
  results: Array<NextResult>;
}) {
  let attempt = 0;
  const next = vi.fn(async () => {
    const result = results[attempt++];
    if (!result) {
      throw new Error(`withTransientRetry called next() ${attempt} times`);
    }
    return result;
  });

  return {
    next,
    result: withTransientRetry({
      ctx,
      type,
      path: 'decision.getProposal',
      next: next as never,
    } as never),
  };
}

describe('withTransientRetry', () => {
  it('replays a query that died on a dropped database socket', async () => {
    const ctx = makeLoggerContext();
    const { next, result } = runRetry({
      ctx,
      type: 'query',
      results: [
        { ok: false, error: droppedSocketError() },
        { ok: true, data: 'proposal' },
      ],
    });

    await expect(result).resolves.toEqual({ ok: true, data: 'proposal' });
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('reports the replay through the request logger', async () => {
    const ctx = makeLoggerContext();
    const { result } = runRetry({
      ctx,
      type: 'query',
      results: [
        { ok: false, error: droppedSocketError() },
        { ok: true, data: 'proposal' },
      ],
    });
    await result;

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'Retrying query after a dropped database connection',
      expect.objectContaining({ attempt: 1 }),
    );
  });

  it('gives up after one replay instead of looping', async () => {
    const ctx = makeLoggerContext();
    const lastError = droppedSocketError();
    const { next, result } = runRetry({
      ctx,
      type: 'query',
      results: [
        { ok: false, error: droppedSocketError() },
        { ok: false, error: lastError },
      ],
    });

    // The final failure is re-thrown rather than returned; tRPC catches it and
    // rebuilds the same `{ ok: false }` result for the caller.
    await expect(result).rejects.toBe(lastError);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('never replays a mutation, which may already have committed', async () => {
    const ctx = makeLoggerContext();
    const failure: NextResult = { ok: false, error: droppedSocketError() };
    const { next, result } = runRetry({
      ctx,
      type: 'mutation',
      results: [failure, { ok: true, data: 'never reached' }],
    });

    await expect(result).resolves.toBe(failure);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('leaves a real query failure alone', async () => {
    const ctx = makeLoggerContext();
    const failure: NextResult = {
      ok: false,
      error: new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        cause: new NotFoundError('Proposal', 'abc'),
      }),
    };
    const { next, result } = runRetry({
      ctx,
      type: 'query',
      results: [failure, { ok: true, data: 'never reached' }],
    });

    await expect(result).resolves.toBe(failure);
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.logger.warn).not.toHaveBeenCalled();
  });

  it('passes a successful query straight through', async () => {
    const ctx = makeLoggerContext();
    const { next, result } = runRetry({
      ctx,
      type: 'query',
      results: [{ ok: true, data: 'proposal' }],
    });

    await expect(result).resolves.toEqual({ ok: true, data: 'proposal' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
