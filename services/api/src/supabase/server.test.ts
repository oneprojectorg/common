import { logger } from '@op/logging';
import type { CookieOptions } from '@op/supabase/lib';
import { describe, expect, it, vi } from 'vitest';

import type { TContext } from '../types';
import { createSBAdminClient } from './server';

type CookieToSet = { name: string; value: string; options: CookieOptions };
type SetAllHandler = (cookiesToSet: CookieToSet[]) => Promise<void>;

const captured = vi.hoisted((): { setAll?: SetAllHandler } => ({}));

vi.mock('@op/supabase/lib', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: SetAllHandler } },
  ) => {
    captured.setAll = options.cookies.setAll;
    return {};
  },
}));

/**
 * The cookie batch `@supabase/ssr` hands to `setAll` when it applies a rotated
 * session — one chunk per part of the auth token.
 */
const REFRESHED_SESSION_COOKIES: CookieToSet[] = [
  { name: 'sb-project-auth-token.0', value: 'chunk-0', options: { path: '/' } },
  { name: 'sb-project-auth-token.1', value: 'chunk-1', options: { path: '/' } },
];

describe('createSBAdminClient — persisting a refreshed session', () => {
  it('drops the whole batch without erroring when the caller cannot write cookies', async () => {
    const { ctx, setCookie } = makeContext({ isServerSideCall: true });

    await applyRefreshedSession(ctx);

    expect(setCookie).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
      cookieNames: ['sb-project-auth-token.0', 'sb-project-auth-token.1'],
      requestId: 'test-request-id',
    });
  });

  it('writes every cookie when the caller owns a response', async () => {
    const { ctx, setCookie } = makeContext({ isServerSideCall: false });

    await applyRefreshedSession(ctx);

    expect(setCookie).toHaveBeenCalledTimes(2);
    expect(setCookie).toHaveBeenNthCalledWith(1, REFRESHED_SESSION_COOKIES[0]);
    expect(setCookie).toHaveBeenNthCalledWith(2, REFRESHED_SESSION_COOKIES[1]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

/**
 * Replays what auth-js does after a successful token rotation: it emits
 * `TOKEN_REFRESHED`, and `@supabase/ssr` writes the new session back through
 * the `setAll` handler this module supplies.
 */
async function applyRefreshedSession(ctx: TContext) {
  createSBAdminClient(ctx);

  const setAll = captured.setAll;

  if (!setAll) {
    throw new Error('createSBAdminClient did not supply a setAll handler');
  }

  await setAll(REFRESHED_SESSION_COOKIES);
}

function makeContext({ isServerSideCall }: { isServerSideCall: boolean }) {
  // A server-side caller context has no response to write to, so its setter
  // throws — see `serverClient.ts`.
  const setCookie = vi.fn(() => {
    if (isServerSideCall) {
      throw new Error('Cannot set cookies in server-side caller context.');
    }
  });

  const ctx: TContext = {
    getCookies: () => ({}),
    getCookie: () => undefined,
    setCookie,
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    requestId: 'test-request-id',
    time: 1700000000000,
    ip: '1.2.3.4',
    reqUrl: 'http://localhost/trpc',
    req: new Request('http://localhost/trpc'),
    isServerSideCall,
  };

  return { ctx, setCookie };
}
