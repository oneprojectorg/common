import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.declineRelationship sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('organization.declineRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.declineRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        ids: [],
      }),
    );
  },
});
