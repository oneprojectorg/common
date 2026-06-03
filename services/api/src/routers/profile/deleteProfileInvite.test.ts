import {
  describeAccessTierGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('profile.deleteProfileInvite', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.profile.deleteProfileInvite({
        inviteId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.profile.deleteProfileInvite({
        inviteId: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.profile.deleteProfileInvite({
        inviteId: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.profile.deleteProfileInvite({
        inviteId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
