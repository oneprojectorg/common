import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
} from '../../test/helpers/gating';
import { createTestContextWithSession } from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/**
 * An unauthenticated caller, which is what these procedures answer.
 *
 * Built through the real context factory rather than a literal: the rate-limit
 * middleware in front of both procedures reads request headers, so a
 * hand-made context fails before reaching the handler.
 */
const publicCaller = async () =>
  createCaller(await createTestContextWithSession(null));

/** What the fake provider answers next. Each test sets what it needs. */
const provider = {
  startVerification: vi.fn(),
  checkVerification: vi.fn(),
};

// `flagIsOn` and `providerIsConfigured` are module-level, so the suites that
// change them run serially. Concurrent tests would read each other's setup and
// fail in whichever order they happened to interleave.

/** Whether the SMS sign-in flag reads on for the current test. */
let flagIsOn = true;

/** Whether SMS is configured at all for the current test. */
let providerIsConfigured = true;

// The vendor never runs here. `getSmsProvider` is the seam the router resolves
// its capabilities through, so replacing it covers both the configured and the
// unconfigured deployment without any Twilio credentials.
vi.mock('@op/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@op/common')>();
  return {
    ...actual,
    getSmsProvider: () => (providerIsConfigured ? provider : null),
    isServerFeatureEnabled: async () => flagIsOn,
    allowPhoneSend: async () => true,
  };
});

const mintPhoneSession = vi.fn();
vi.mock('../../supabase/mintPhoneSession', () => ({
  mintPhoneSession: (input: unknown) => mintPhoneSession(input),
}));

/** Twilio reserves this range for testing, so no fixture names a real line. */
const PHONE = '+15005550007';

beforeEach(() => {
  vi.clearAllMocks();
  flagIsOn = true;
  providerIsConfigured = true;
  provider.startVerification.mockResolvedValue({ status: 'pending' });
  provider.checkVerification.mockResolvedValue({ status: 'approved' });
  mintPhoneSession.mockResolvedValue({
    accessToken: 'access',
    refreshToken: 'refresh',
    authUserId: 'auth-user-id',
  });
});

// Both procedures are public `commonProcedure`s: they carry no authentication
// middleware, because someone signing in has no session yet. That is the point
// of this matrix — every caller kind reaches the handler, so the checks inside
// it are the only thing between the internet and a minted session.
describeAccessTierGating('account.startPhoneLogin', {
  noJwt: accessTierGatingCell('admits no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.account.startPhoneLogin({ phone: PHONE }),
    ).resolves.toEqual({ status: 'pending' });
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expect(
        caller.account.startPhoneLogin({ phone: PHONE }),
      ).resolves.toEqual({ status: 'pending' });
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(
        caller.account.startPhoneLogin({ phone: PHONE }),
      ).resolves.toEqual({ status: 'pending' });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expect(
        caller.account.startPhoneLogin({ phone: PHONE }),
      ).resolves.toEqual({ status: 'pending' });
    },
  ),
});

describe('account.startPhoneLogin: admission rules', () => {
  const caller = publicCaller;

  it('refuses to send while the flag is off', async () => {
    flagIsOn = false;

    // The flag is the rollout control. If this check is ever dropped, the
    // feature ships to everyone the moment the code deploys.
    await expect(
      (await caller()).account.startPhoneLogin({ phone: PHONE }),
    ).rejects.toThrow(/not available/i);
    expect(provider.startVerification).not.toHaveBeenCalled();
  });

  it('refuses to send when no verification service is configured', async () => {
    providerIsConfigured = false;

    await expect(
      (await caller()).account.startPhoneLogin({ phone: PHONE }),
    ).rejects.toThrow(/not configured/i);
  });

  it('reports a refused number without pretending a code went out', async () => {
    provider.startVerification.mockResolvedValue({
      status: 'rejected',
      reason: 'unreachable',
    });

    await expect(
      (await caller()).account.startPhoneLogin({ phone: PHONE }),
    ).resolves.toEqual({ status: 'rejected' });
  });

  it('normalizes the number before it reaches the provider', async () => {
    await (await caller()).account.startPhoneLogin({ phone: '(500) 555-0007' });

    // The panel sends what a person typed. A provider that received it
    // verbatim would text a different number, or none.
    expect(provider.startVerification).toHaveBeenCalledWith({
      to: '+15005550007',
    });
  });
});

describe('account.verifyPhoneLogin: admission rules', () => {
  const caller = publicCaller;
  const input = { phone: PHONE, code: '123456' };

  it('refuses to check while the flag is off', async () => {
    flagIsOn = false;

    await expect(
      (await caller()).account.verifyPhoneLogin(input),
    ).rejects.toThrow(/not available/i);
    expect(mintPhoneSession).not.toHaveBeenCalled();
  });

  it('mints no session for a wrong code', async () => {
    provider.checkVerification.mockResolvedValue({ status: 'rejected' });

    await expect(
      (await caller()).account.verifyPhoneLogin(input),
    ).resolves.toEqual({
      status: 'rejected',
    });
    expect(mintPhoneSession).not.toHaveBeenCalled();
  });

  it('mints no session for an expired verification', async () => {
    provider.checkVerification.mockResolvedValue({ status: 'expired' });

    // Kept apart from a wrong code on purpose: the two need opposite
    // instructions, and collapsing them sends a person retyping a dead code.
    await expect(
      (await caller()).account.verifyPhoneLogin(input),
    ).resolves.toEqual({
      status: 'expired',
    });
    expect(mintPhoneSession).not.toHaveBeenCalled();
  });

  it('issues a session once the provider approves', async () => {
    await expect(
      (await caller()).account.verifyPhoneLogin(input),
    ).resolves.toEqual({
      status: 'approved',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(mintPhoneSession).toHaveBeenCalledTimes(1);
  });
});
