import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

describeGating('organization.approveRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.approveRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.approveRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.organization.approveRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.approveRelationship({
        targetOrganizationId: '00000000-0000-0000-0000-000000000000',
        sourceOrganizationId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
