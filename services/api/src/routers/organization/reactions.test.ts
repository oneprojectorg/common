import {
  describeAccessTierGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.toggleReaction', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.organization.toggleReaction({
        postId: 'x',
        reactionType: 'like',
      }),
    );
  },
});
