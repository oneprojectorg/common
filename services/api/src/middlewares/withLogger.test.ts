import {
  AccessTierError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
} from '@op/common';
import { POSTHOG_SESSION_ID_COOKIE } from '@op/core';
import { logger, setLogSessionId } from '@op/logging';
import { AccessControlException } from 'access-zones';
import { describe, expect, it, vi } from 'vitest';

import type { TContext, TContextWithLogger } from '../types';
import withLogger from './withLogger';

type NextResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code: string;
        name: string;
        message?: string;
        cause?: unknown;
      };
    }
  | { ok: false; error?: undefined };

function makeCtx({
  header,
  cookie,
}: {
  header?: string;
  cookie?: string;
}): TContext {
  const headers = new Headers();
  if (header) {
    headers.set('x-posthog-session-id', header);
  }

  return {
    getCookies: () => ({}),
    getCookie: (name) =>
      name === POSTHOG_SESSION_ID_COOKIE ? cookie : undefined,
    setCookie: () => {},
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    requestId: 'req-1',
    time: 1700000000000,
    ip: '203.0.113.42',
    reqUrl: 'http://localhost/trpc',
    req: new Request('http://localhost/trpc', { headers }),
  };
}

function runLogger(ctx: TContext, result: NextResult) {
  const next = vi.fn(async () => result);
  return withLogger({
    ctx,
    path: 'organization.getBySlug',
    type: 'query',
    next: next as never,
  } as never);
}

describe('withLogger — PostHog session id', () => {
  it('stamps the session id from the request header', async () => {
    await runLogger(makeCtx({ header: 'sess-from-header' }), { ok: true });

    expect(setLogSessionId).toHaveBeenCalledWith('sess-from-header');
  });

  it('falls back to the cookie when the header is absent (SSR path)', async () => {
    await runLogger(makeCtx({ cookie: 'sess-from-cookie' }), { ok: true });

    expect(setLogSessionId).toHaveBeenCalledWith('sess-from-cookie');
  });

  it('prefers the header over the cookie when both are present', async () => {
    await runLogger(
      makeCtx({ header: 'sess-from-header', cookie: 'sess-from-cookie' }),
      { ok: true },
    );

    expect(setLogSessionId).toHaveBeenCalledWith('sess-from-header');
  });

  it('does not stamp a session id when neither is present', async () => {
    await runLogger(makeCtx({}), { ok: true });

    expect(setLogSessionId).not.toHaveBeenCalled();
  });
});

describe('withLogger — request logging', () => {
  it('emits a wide log on success so the happy path carries request context', async () => {
    await runLogger(makeCtx({ header: 'sess' }), { ok: true });

    expect(logger.info).toHaveBeenCalledWith(
      'organization.getBySlug OK',
      expect.objectContaining({
        requestId: 'req-1',
        path: 'organization.getBySlug',
        type: 'query',
        status: 'ok',
      }),
    );
  });

  it('logs the actual error message as the body on failure', async () => {
    await runLogger(makeCtx({ header: 'sess' }), {
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        name: 'TRPCError',
        message: "Organization with ID 'anon-abc' not found.",
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Organization with ID 'anon-abc' not found.",
      expect.objectContaining({
        status: 'error',
        path: 'organization.getBySlug',
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorName: 'TRPCError',
      }),
    );
  });

  it('falls back to a generic body when the error has no message', async () => {
    await runLogger(makeCtx({ header: 'sess' }), {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', name: 'TRPCError' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({ status: 'error' }),
    );
  });
});

describe('withLogger — client IP', () => {
  it('does not attach the IP to a successful request', async () => {
    await runLogger(makeCtx({ header: 'sess' }), { ok: true });

    expect(logger.info).toHaveBeenCalledWith(
      'organization.getBySlug OK',
      expect.not.objectContaining({ ip: expect.anything() }),
    );
  });

  it('does not attach the IP to a routine failure', async () => {
    const cause = new NotFoundError('Organization', 'acme');

    await runLogger(makeCtx({ header: 'sess' }), {
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        name: 'TRPCError',
        message: cause.message,
        cause,
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      cause.message,
      expect.not.objectContaining({ ip: expect.anything() }),
    );
  });

  it('attaches an anonymized IP to an authorization or rate-limit failure', async () => {
    // tRPC wraps anything that isn't a TRPCError as INTERNAL_SERVER_ERROR, so
    // the cause is what identifies the rejection.
    const causes = [
      new AccessTierError('none'),
      new UnauthorizedError(),
      new RateLimitError(),
      new AccessControlException({
        message: 'Insufficient permissions',
        status: 'forbidden',
      }),
    ];

    for (const cause of causes) {
      await runLogger(makeCtx({ header: 'sess' }), {
        ok: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          name: 'TRPCError',
          message: cause.message,
          cause,
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        cause.message,
        expect.objectContaining({ ip: '203.0.113.0' }),
      );
    }
  });

  it('attaches an anonymized IP to an unhandled failure', async () => {
    await runLogger(makeCtx({ header: 'sess' }), { ok: false });

    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled error',
      expect.objectContaining({ status: 'unhandled_error', ip: '203.0.113.0' }),
    );
  });

  it('does not attach the IP to a log emitted from a procedure', async () => {
    const next = vi.fn(async ({ ctx }: { ctx: TContextWithLogger }) => {
      ctx.logger.info('did a thing');
      return { ok: true };
    });

    await withLogger({
      ctx: makeCtx({}),
      path: 'organization.getBySlug',
      type: 'query',
      next: next as never,
    } as never);

    expect(logger.info).toHaveBeenCalledWith(
      'did a thing',
      expect.not.objectContaining({ ip: expect.anything() }),
    );
  });
});
