import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: posts.getPosts sits on commonAuthedProcedure, which
// rejects no-JWT and anon-JWT at the auth middleware. A normal authenticated
// caller is admitted.
describeGating('posts.getPosts', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.posts.getPosts({})).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.posts.getPosts({})).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(caller.posts.getPosts({}));
  },
});
