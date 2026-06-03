import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('taxonomy.getTerms', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.taxonomy.getTerms({ name: 'xxx' }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.taxonomy.getTerms({ name: 'xxx' }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.taxonomy.getTerms({ name: 'xxx' }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(caller.taxonomy.getTerms({ name: 'xxx' }));
  },
});
