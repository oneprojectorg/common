import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: posts.listProfilePosts sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted.
describeGating('posts.listProfilePosts', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.posts.listProfilePosts({ profileId: 'x' }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.posts.listProfilePosts({ profileId: 'x' }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.posts.listProfilePosts({ profileId: 'x' }),
    );
  },
});
