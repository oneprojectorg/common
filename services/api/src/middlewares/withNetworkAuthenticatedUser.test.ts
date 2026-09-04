import { describe, expect, it } from 'vitest';

import { createGatingCallers } from '../test/helpers/gating/callers';

/**
 * The network gate, exercised through a phone-only account.
 *
 * `withNetworkAuthenticatedUser` guards every `networkAuthenticatedProcedure`
 * in the application. Signing in by phone authenticates someone and admits
 * nobody: membership reads an email address against the network domains and
 * the allow list, and a phone-only account holds no email for either to read.
 *
 * Every other gating fixture in the repository is built from an email, so
 * nothing else reaches the gate with a credential it must refuse.
 *
 * `account.getMyAccount` reports membership without requiring it, so it can
 * answer for an admitted and a refused caller alike.
 */
describe('the network gate and a phone-only account', () => {
  it('refuses an account that holds only a phone number', async ({
    onTestFinished,
  }) => {
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.phoneJwt();

    const account = await caller.account.getMyAccount();

    expect(account?.isNetworkMember).toBe(false);
  });

  it('still admits an account whose email belongs to the network', async ({
    onTestFinished,
  }) => {
    // Without this the refusal above would also pass with a gate that refused
    // everyone.
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.networkJwt();

    const account = await caller.account.getMyAccount();

    expect(account?.isNetworkMember).toBe(true);
  });
});
