import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.addRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.addRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
        'anon',
      );
    },
  ),

  // Confirmed out-of-network users (e.g. accounts claimed from a public
  // decision process) may like/follow — the tier is confirmed, not network.
  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.profile.addRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.addRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),
});

describeAccessTierGating('profile.removeRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.removeRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
        'anon',
      );
    },
  ),

  // See addRelationship: confirmed tier admits out-of-network claimed users.
  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.profile.removeRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.removeRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),
});

describeAccessTierGating('profile.getRelationships', {
  noJwt: accessTierGatingCell(
    'admits no-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.profile.getRelationships({ types: ['following'] }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.profile.getRelationships({ types: ['following'] }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.profile.getRelationships({ types: ['following'] }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.getRelationships({ types: ['following'] }),
      );
    },
  ),
});
