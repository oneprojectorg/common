import { expect } from 'vitest';

import {
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';

describeAccessTierGating('platform.admin.listAllOrganizations', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.listAllOrganizations(),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.listAllOrganizations(),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.platform.admin.listAllOrganizations(),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAccessTierGate(
      caller.platform.admin.listAllOrganizations(),
    );
  },
});
