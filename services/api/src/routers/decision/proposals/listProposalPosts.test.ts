import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';

// `decision.listProposalPosts` is an open procedure: every caller is admitted
// past the tier gate, and the parent-decision READ check happens in the
// service. These cells only assert admission (rejection, if any, is not an
// `AccessTierError`); a bogus profileId is enough, since the service rejects on
// the missing proposal — still a pass at the tier. Resource-level authorization
// is covered by posts/getPosts.proposalAccess.test.ts.
describeAccessTierGating('decision.listProposalPosts', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalPosts({ profileId: 'x' }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalPosts({ profileId: 'x' }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalPosts({ profileId: 'x' }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalPosts({ profileId: 'x' }),
      );
    },
  ),
});
