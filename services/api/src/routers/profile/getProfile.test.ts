import {
  describeProcedureGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeProcedureGating('profile.list', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(caller.profile.list(), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(caller.profile.list(), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(caller.profile.list(), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.profile.list());
  },
});

describeProcedureGating('profile.getBySlug', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(caller.profile.getBySlug({ slug: 'x' }), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(caller.profile.getBySlug({ slug: 'x' }), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(caller.profile.getBySlug({ slug: 'x' }), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.profile.getBySlug({ slug: 'x' }));
  },
});
