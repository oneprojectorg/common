import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

describeGating('posts.uploadPostAttachment', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    );
  },
});
