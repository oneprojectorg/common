import {
  describeAccessTierGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('account.uploadBannerImage', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.account.uploadBannerImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.account.uploadBannerImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.account.uploadBannerImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.account.uploadBannerImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
    );
  },
});
