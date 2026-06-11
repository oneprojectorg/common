import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createGatingCallers } from '../../test/helpers/gating/callers';

// Open procedure: every tier is admitted past the gate; what each tier
// resolves to is covered separately below.

describeAccessTierGating('account.getMyAccount', {
  noJwt: accessTierGatingCell(
    'admits no-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(caller.account.getMyAccount());
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.account.getMyAccount());
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.account.getMyAccount());
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.account.getMyAccount());
    },
  ),
});

describe.concurrent('account.getMyAccount: resolution by tier', () => {
  it('resolves null for a no-JWT (public) caller', async ({
    onTestFinished,
  }) => {
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.noJwt();

    await expect(caller.account.getMyAccount()).resolves.toBeNull();
  });

  it('resolves the email-less account for an anonymous caller', async ({
    onTestFinished,
  }) => {
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.anonJwt();

    const account = await caller.account.getMyAccount();
    expect(account).not.toBeNull();
    expect(account?.authUserId).toBeDefined();
    expect(account?.email).toBeNull();
  });

  it('resolves the account for an authenticated user', async ({
    onTestFinished,
  }) => {
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.userJwt();

    const account = await caller.account.getMyAccount();
    expect(account).not.toBeNull();
    expect(account?.authUserId).toBeDefined();
  });
});
