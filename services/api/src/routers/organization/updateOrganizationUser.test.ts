import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.updateOrganizationUser', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
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
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
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
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.organization.updateOrganizationUser({
          organizationId: '00000000-0000-0000-0000-000000000000',
          organizationUserId: '00000000-0000-0000-0000-000000000000',
          data: {},
        }),
      );
    },
  ),
});
