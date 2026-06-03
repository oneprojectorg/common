import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

const input = { website: 'https://example.com', orgType: 'x', bio: 'x' };

describeAccessTierGating('organization.create', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.organization.create(input), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(caller.organization.create(input), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(caller.organization.create(input), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(caller.organization.create(input));
  },
});
