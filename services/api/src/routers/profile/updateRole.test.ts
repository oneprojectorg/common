import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.updateRole', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
    );
  },
});
