import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// Kept in its own file rather than appended to __tests__/linkPreview.test.ts:
// that suite stubs `global.fetch`, which breaks the Supabase auth network calls
// the gating callers depend on (anonymous sign-in / sign-up).
//
const input = { url: 'https://example.com' };

// openProcedure: the endpoint is public, so every tier (including no-JWT
// visitors) clears the tier gate. There is no per-resource authorization to
// defer to the service layer — the endpoint only proxies an arbitrary URL to
// iframely — so abuse is bounded by IP rate limiting and the 1h result cache.
describeAccessTierGating('content.linkPreview', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(caller.content.linkPreview(input));
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.content.linkPreview(input));
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.content.linkPreview(input));
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.content.linkPreview(input));
    },
  ),
});
