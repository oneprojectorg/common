import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: account.uploadImage sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted.
describeGating('account.uploadImage', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.account.uploadImage({
        file: 'x',
        fileName: 'x',
        mimeType: 'image/png',
      }),
    );
  },
});
