import {
  describeProcedureGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeProcedureGating('taxonomy.getTerms', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.taxonomy.getTerms({ name: 'xxx' }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.taxonomy.getTerms({ name: 'xxx' }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.taxonomy.getTerms({ name: 'xxx' }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.taxonomy.getTerms({ name: 'xxx' }));
  },
});
