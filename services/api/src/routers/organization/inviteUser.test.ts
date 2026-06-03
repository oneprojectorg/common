import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { eq } from 'drizzle-orm';

import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.invite', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.invite({ emails: ['gate@example.com'] }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.organization.invite({ emails: ['gate@example.com'] }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.organization.invite({ emails: ['gate@example.com'] }),
      'user',
    );
  },

  networkJwt: async ({ callers, onTestFinished }) => {
    // A platform invite (no organizationId) writes the invitee to `allowList`,
    // which the global teardown asserts is empty. Use a unique email and clean
    // up just that row so concurrent tests are unaffected.
    const invitee = `gating-invite-${crypto.randomUUID()}@example.com`;
    onTestFinished(async () => {
      await db.delete(allowList).where(eq(allowList.email, invitee));
    });

    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.organization.invite({ emails: [invitee] }),
    );
  },
});
