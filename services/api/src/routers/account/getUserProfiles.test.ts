import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

describeGating('account.getUserProfiles', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.account.getUserProfiles()).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.account.getUserProfiles()).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(caller.account.getUserProfiles()).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.account.getUserProfiles());
  },
});
