import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.search sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted.
describeGating('organization.search', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.organization.search({ q: 'x' })).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.organization.search({ q: 'x' })).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.organization.search({ q: 'x' }));
  },
});
