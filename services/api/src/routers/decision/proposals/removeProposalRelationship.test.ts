import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';

// See addProposalRelationship.test.ts: confirmed tier admits out-of-network
// claimed users; the service layer gates proposal targets on the parent
// decision.
describeAccessTierGating('decision.removeProposalRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.removeProposalRelationship({
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
        caller.decision.removeProposalRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.removeProposalRelationship({
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
        caller.decision.removeProposalRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),
});
