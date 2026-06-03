import {
  describeProcedureGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeProcedureGating('organization.checkMembership', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.organization.checkMembership({
        email: 'gate@example.com',
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.organization.checkMembership({
        email: 'gate@example.com',
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.organization.checkMembership({
        email: 'gate@example.com',
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.organization.checkMembership({
        email: 'gate@example.com',
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
