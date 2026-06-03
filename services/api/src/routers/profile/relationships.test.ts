import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.addRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    );
  },
});

describeAccessTierGating('profile.removeRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    );
  },
});

describeAccessTierGating('profile.getRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.getRelationships({ types: ['following'] }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.profile.getRelationships({ types: ['following'] }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.profile.getRelationships({ types: ['following'] }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.profile.getRelationships({ types: ['following'] }),
    );
  },
});
