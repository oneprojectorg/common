import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../../test/helpers/gating';

// Network gating matrix: platform.admin.updateUserProfile sits on
// withAuthenticatedPlatformAdmin, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('platform.admin.updateUserProfile', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    );
  },
});
