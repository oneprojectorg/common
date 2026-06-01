import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: account.getUserProfiles sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('account.getUserProfiles', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.account.getUserProfiles()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.account.getUserProfiles()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.account.getUserProfiles());
  },
});
