import { expect } from 'vitest';

import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';

describeAccessTierGating('platform.admin.getStats', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.platform.admin.getStats(), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(caller.platform.admin.getStats(), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(caller.platform.admin.getStats()).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(caller.platform.admin.getStats());
  },
});
