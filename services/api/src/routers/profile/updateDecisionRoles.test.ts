import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

const decisionPermissions = {
  delete: false,
  update: false,
  read: false,
  create: false,
  admin: false,
  inviteMembers: false,
  review: false,
  submitProposals: false,
  vote: false,
};

describeAccessTierGating('profile.updateDecisionRoles', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.profile.updateDecisionRoles({
          roleId: '00000000-0000-0000-0000-000000000000',
          decisionPermissions,
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.profile.updateDecisionRoles({
          roleId: '00000000-0000-0000-0000-000000000000',
          decisionPermissions,
        }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.profile.updateDecisionRoles({
          roleId: '00000000-0000-0000-0000-000000000000',
          decisionPermissions,
        }),
      );
    },
  ),
});
