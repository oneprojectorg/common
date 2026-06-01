import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

describeGating('organization.invite', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.invite({ emails: ['gate@example.com'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.invite({ emails: ['gate@example.com'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.organization.invite({ emails: ['gate@example.com'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
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
    await expectPassesAuthGate(
      caller.organization.invite({ emails: [invitee] }),
    );
  },
});
