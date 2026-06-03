import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.listAllPosts', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.organization.listAllPosts(), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(caller.organization.listAllPosts(), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(caller.organization.listAllPosts(), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(caller.organization.listAllPosts());
  },
});
