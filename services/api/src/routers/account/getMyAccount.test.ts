import { expect } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
} from '../../test/helpers/gating';

describeAccessTierGating('account.getMyAccount', {
  noJwt: accessTierGatingCell(
    'resolves null for a no-JWT (public) caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expect(caller.account.getMyAccount()).resolves.toBeNull();
    },
  ),

  anonJwt: accessTierGatingCell(
    'resolves null for an anonymous caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expect(caller.account.getMyAccount()).resolves.toBeNull();
    },
  ),

  userJwt: accessTierGatingCell(
    'resolves the account for an out-of-network user',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      const account = await caller.account.getMyAccount();
      expect(account).not.toBeNull();
      expect(account?.authUserId).toBeDefined();
    },
  ),

  networkJwt: accessTierGatingCell(
    'resolves the account for an in-network user',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      const account = await caller.account.getMyAccount();
      expect(account).not.toBeNull();
      expect(account?.authUserId).toBeDefined();
    },
  ),
});
