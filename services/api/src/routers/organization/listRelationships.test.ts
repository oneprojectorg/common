import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: organization.listPendingRelationships sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('organization.listPendingRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.listPendingRelationships(),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.listPendingRelationships(),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(caller.organization.listPendingRelationships());
  },
});

// Network gating matrix: organization.listDirectedRelationships sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('organization.listDirectedRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});

// Network gating matrix: organization.listRelationships sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('organization.listRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
