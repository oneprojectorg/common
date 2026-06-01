import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.create sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted. website/orgType/bio are required.
const input = { website: 'https://example.com', orgType: 'x', bio: 'x' };

describeGating('organization.create', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.organization.create(input)).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.organization.create(input)).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.organization.create(input));
  },
});
