import { describe, it } from 'vitest';

import {
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../test/helpers/gating';
import { createGatingCallers } from '../test/helpers/gating/callers';

// `organization.list` is a networkAuthenticatedProcedure taking no input, so a
// call reaches this middleware and nothing past it.
describe('withNetworkAuthenticatedUser', () => {
  it('refuses an account that holds only a phone number', async ({
    onTestFinished,
  }) => {
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.phoneJwt();

    await expectFailsAccessTierGate(caller.organization.list(), 'user');
  });

  it('admits an account whose email belongs to the network', async ({
    onTestFinished,
  }) => {
    // Without this the refusal above would also pass against a gate that
    // refused everyone.
    const callers = createGatingCallers(onTestFinished);
    const caller = await callers.networkJwt();

    await expectPassesAccessTierGate(caller.organization.list());
  });
});
