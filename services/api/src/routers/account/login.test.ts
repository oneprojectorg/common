import { expect } from 'vitest';

import { describeGating } from '../../test/helpers/gating';

// account.login is a PUBLIC `commonProcedure` — it has no authentication
// middleware and ignores the caller's JWT entirely (it gates on the *input*
// email against the invite allow-list, not on the session). This matrix
// documents that all three caller kinds reach the handler identically.
//
// `usingOAuth: true` skips the OTP send side-effect, and an `@oneproject.org`
// email clears the allow-list via `allowedEmailDomains`, so the handler returns
// `true` regardless of who is calling.
const input = { email: 'gate@oneproject.org', usingOAuth: true };

describeGating('account.login', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(caller.account.login(input)).resolves.toBe(true);
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(caller.account.login(input)).resolves.toBe(true);
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expect(caller.account.login(input)).resolves.toBe(true);
  },
});
