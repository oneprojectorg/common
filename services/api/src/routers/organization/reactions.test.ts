import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.toggleReaction sits on
// commonAuthedProcedure (via the aliased `reactionProcedure`), which rejects
// no-JWT and anon-JWT at the auth middleware. A normal authenticated caller is
// admitted.
describeGating('organization.toggleReaction', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
    );
  },
});
