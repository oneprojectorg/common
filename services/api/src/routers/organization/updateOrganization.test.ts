import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.update sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted.
describeGating('organization.update', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.organization.update({ id: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthenticationError' },
      },
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.organization.update({ id: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthenticationError' },
      },
    );
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(caller.organization.update({ id: 'x' }));
  },
});
