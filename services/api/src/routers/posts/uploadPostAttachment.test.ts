import {
  describeAccessTierGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('posts.uploadPostAttachment', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.posts.uploadPostAttachment({
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
      caller.posts.uploadPostAttachment({
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
      caller.posts.uploadPostAttachment({
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
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    );
  },
});
