import {
  describeGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeGating('organization.addRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
    );
  },
});
