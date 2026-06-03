import {
  describeGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeGating('organization.uploadAvatarImage', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
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
    await expectFailsTierGate(
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
    await expectFailsTierGate(
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
    await expectPassesTierGate(
      caller.organization.uploadAvatarImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    );
  },
});
