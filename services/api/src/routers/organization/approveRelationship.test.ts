import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.approveRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.approveRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.approveRelationship({
          targetOrganizationId: '00000000-0000-0000-0000-000000000000',
          sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
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
        caller.organization.approveRelationship({
          targetOrganizationId: '00000000-0000-0000-0000-000000000000',
          sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
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
        caller.organization.approveRelationship({
          targetOrganizationId: '00000000-0000-0000-0000-000000000000',
          sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    },
  ),
});
