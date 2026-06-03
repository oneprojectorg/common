import { expect } from 'vitest';

import {
  describeProcedureGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../../test/helpers/gating';

describeProcedureGating('platform.admin.listAllOrganizations', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.platform.admin.listAllOrganizations(),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
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
    await expectPassesTierGate(caller.platform.admin.listAllOrganizations());
  },
});
