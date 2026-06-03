import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('account.uploadImage', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
    );
  },
});
