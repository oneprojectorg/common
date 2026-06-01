import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../../test/helpers/gating';

describeGating('platform.admin.updateUserProfile', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.platform.admin.updateUserProfile({ authUserId: 'x', data: {} }),
    );
  },
});
