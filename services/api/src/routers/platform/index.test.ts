import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: platform.getStats sits on commonAuthedProcedure, which
// rejects no-JWT and anon-JWT at the auth middleware. A normal authenticated
// caller is admitted.
describeGating('platform.getStats', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.platform.getStats()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.platform.getStats()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(caller.platform.getStats());
  },
});
