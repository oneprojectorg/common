import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: account.updateUserProfile sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted. The input schema is
// fully `.partial()`, so an empty object is type-valid.
describeGating('account.updateUserProfile', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.account.updateUserProfile({})).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.account.updateUserProfile({})).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.account.updateUserProfile({}));
  },
});
