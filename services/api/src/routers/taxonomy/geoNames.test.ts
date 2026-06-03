import {
  describeProcedureGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeProcedureGating('taxonomy.getGeoNames', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(caller.taxonomy.getGeoNames({ q: 'xx' }), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(caller.taxonomy.getGeoNames({ q: 'xx' }), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(caller.taxonomy.getGeoNames({ q: 'xx' }), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.taxonomy.getGeoNames({ q: 'xx' }));
  },
});
