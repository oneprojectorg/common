import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: posts.uploadPostAttachment sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
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
      cause: { name: 'AuthenticationError' },
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
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(
      caller.posts.uploadPostAttachment({
        file: 'x',
        fileName: 'x',
        mimeType: 'x',
      }),
    );
  },
});
