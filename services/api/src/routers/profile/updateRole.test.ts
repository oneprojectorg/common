import {
  describeProcedureGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeProcedureGating('profile.updateRole', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.profile.updateRole({
        roleId: '00000000-0000-0000-0000-000000000000',
        name: 'x',
      }),
    );
  },
});
