import { NotFoundError, UnauthorizedError, ValidationError } from '@op/common';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import { AccessControlException } from 'access-zones';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { classifyRequestError } from '../lib/error';
import withLogger from './withLogger';

// A service-layer throw reaches the middleware wrapped as INTERNAL_SERVER_ERROR
// with the original error on `cause` — mirror that shape here.
const wrap = (cause: unknown) =>
  new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause });

describe('classifyRequestError', () => {
  it('resolves CommonError causes to their real status', () => {
    expect(classifyRequestError(wrap(new UnauthorizedError()))).toEqual({
      httpStatus: 403,
      code: 'FORBIDDEN',
    });
    expect(
      classifyRequestError(wrap(new NotFoundError('Organization', 'anon-1'))),
    ).toEqual({ httpStatus: 404, code: 'NOT_FOUND' });
    expect(classifyRequestError(wrap(new ValidationError('bad')))).toEqual({
      httpStatus: 400,
      code: 'BAD_REQUEST',
    });
  });

  it('treats an access-zones denial as 403', () => {
    expect(
      classifyRequestError(
        wrap(
          new AccessControlException({ message: 'nope', status: 'forbidden' }),
        ),
      ),
    ).toEqual({ httpStatus: 403, code: 'FORBIDDEN' });
  });

  it('keeps a genuine unexpected error at 500', () => {
    expect(classifyRequestError(wrap(new Error('boom')))).toEqual({
      httpStatus: 500,
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('falls back to the native code for a real TRPCError', () => {
    expect(classifyRequestError(new TRPCError({ code: 'CONFLICT' }))).toEqual({
      httpStatus: 409,
      code: 'CONFLICT',
    });
  });
});

describe('withLogger severity', () => {
  const invokeWith = (error: TRPCError) =>
    withLogger({
      ctx: { requestId: 'req-1', ip: '127.0.0.1', time: Date.now() },
      path: 'test.path',
      type: 'query',
      next: async () => ({ ok: false, error }),
    } as unknown as Parameters<typeof withLogger>[0]);

  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  it('logs expected 4xx (auth/not-found) at warn, not error', async () => {
    await invokeWith(wrap(new UnauthorizedError('no access')));

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({ errorCode: 'FORBIDDEN', httpStatus: 403 }),
    );
  });

  it('logs a genuine 500 at error', async () => {
    await invokeWith(wrap(new Error('boom')));

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({
        errorCode: 'INTERNAL_SERVER_ERROR',
        httpStatus: 500,
      }),
    );
  });
});
