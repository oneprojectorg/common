import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.updateOrganizationUser', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
    );
  },
});
