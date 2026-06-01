import { db } from '@op/db/client';
import { allowList } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.invite sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted. The input is a union; the `emails` branch
// only requires a non-empty array of valid emails.
describeGating('organization.invite', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.invite({ emails: ['gate@example.com'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.invite({ emails: ['gate@example.com'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers, onTestFinished }) => {
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
