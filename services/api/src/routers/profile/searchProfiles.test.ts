import {
  describeAccessTierGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.search', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(caller.profile.search({ q: 'x' }), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(caller.profile.search({ q: 'x' }), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(caller.profile.search({ q: 'x' }), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.profile.search({ q: 'x' }));
  },
});
