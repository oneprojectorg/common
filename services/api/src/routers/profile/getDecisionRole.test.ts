import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.getDecisionRole', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.getDecisionRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.profile.getDecisionRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.profile.getDecisionRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.profile.getDecisionRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
