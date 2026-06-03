import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.declineRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
    );
  },
});
