import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.uploadAvatarImage', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.organization.uploadAvatarImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.organization.uploadAvatarImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.organization.uploadAvatarImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.organization.uploadAvatarImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    );
  },
});
