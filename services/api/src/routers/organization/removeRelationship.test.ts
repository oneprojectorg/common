import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.removeRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.removeRelationship({
        id: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.organization.removeRelationship({
        id: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.organization.removeRelationship({
        id: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.organization.removeRelationship({
        id: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
