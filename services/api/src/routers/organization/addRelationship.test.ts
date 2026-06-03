import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.addRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
    );
  },
});
