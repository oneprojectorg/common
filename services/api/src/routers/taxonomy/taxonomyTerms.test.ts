import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: taxonomy.getTerms sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted.
describeGating('taxonomy.getTerms', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.taxonomy.getTerms({ name: 'xxx' }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.taxonomy.getTerms({ name: 'xxx' }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.taxonomy.getTerms({ name: 'xxx' }));
  },
});
