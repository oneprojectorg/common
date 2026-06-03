import {
  describeGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

const input = { website: 'https://example.com', orgType: 'x', bio: 'x' };

describeGating('organization.create', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(caller.organization.create(input), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(caller.organization.create(input), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(caller.organization.create(input), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.organization.create(input));
  },
});
