import { expect } from 'vitest';

import {
  describeGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../../test/helpers/gating';

describeGating('platform.admin.getStats', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(caller.platform.admin.getStats(), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(caller.platform.admin.getStats(), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(caller.platform.admin.getStats()).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.platform.admin.getStats());
  },
});
