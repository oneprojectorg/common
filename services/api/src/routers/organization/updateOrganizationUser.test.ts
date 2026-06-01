import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.updateOrganizationUser sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted. `data` is required but
// all of its fields are optional, so an empty object satisfies the type.
describeGating('organization.updateOrganizationUser', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.updateOrganizationUser({
        organizationId: '00000000-0000-0000-0000-000000000000',
        organizationUserId: '00000000-0000-0000-0000-000000000000',
        data: {},
      }),
    );
  },
});
