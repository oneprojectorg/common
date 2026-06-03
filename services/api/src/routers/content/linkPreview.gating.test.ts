import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// Kept in its own file rather than appended to __tests__/linkPreview.test.ts:
// that suite stubs `global.fetch`, which breaks the Supabase auth network calls
// the gating callers depend on (anonymous sign-in / sign-up).
//
const input = { url: 'https://example.com' };

describeAccessTierGating('content.linkPreview', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.content.linkPreview(input), 'none');
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(caller.content.linkPreview(input), 'anon');
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsAccessTierGate(caller.content.linkPreview(input), 'user');
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(caller.content.linkPreview(input));
  },
});
