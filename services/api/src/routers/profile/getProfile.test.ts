import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: profile.list sits on commonAuthedProcedure, which
// rejects no-JWT and anon-JWT at the auth middleware. A normal authenticated
// caller is admitted.
describeGating('profile.list', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.profile.list()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.profile.list()).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(caller.profile.list());
  },
});

// Network gating matrix: profile.getBySlug sits on commonAuthedProcedure, which
// rejects no-JWT and anon-JWT at the auth middleware. A normal authenticated
// caller is admitted.
describeGating('profile.getBySlug', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.profile.getBySlug({ slug: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthenticationError' },
      },
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.profile.getBySlug({ slug: 'x' })).rejects.toMatchObject(
      {
        cause: { name: 'AuthenticationError' },
      },
    );
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(caller.profile.getBySlug({ slug: 'x' }));
  },
});
