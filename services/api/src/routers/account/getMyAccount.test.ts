import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: getMyAccount sits on `commonAuthedProcedure`, which
// rejects no-JWT and anon-JWT at the auth middleware. A normal authenticated
// caller is admitted.
describeGating('account.getMyAccount', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.account.getMyAccount()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.account.getMyAccount()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.account.getMyAccount());
  },
});
