import {
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
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    );
  },
});
