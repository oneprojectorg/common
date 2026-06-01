import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Kept in its own file rather than appended to __tests__/linkPreview.test.ts:
// that suite stubs `global.fetch`, which breaks the Supabase auth network calls
// the gating callers depend on (anonymous sign-in / sign-up).
//
const input = { url: 'https://example.com' };

describeGating('content.linkPreview', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.content.linkPreview(input)).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.content.linkPreview(input)).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(caller.content.linkPreview(input)).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.content.linkPreview(input));
  },
});
