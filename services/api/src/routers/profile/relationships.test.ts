import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

// Network gating matrix: profile.addRelationship sits on commonAuthedProcedure,
// which rejects no-JWT and anon-JWT at the auth middleware. A normal
// authenticated caller is admitted.
describeGating('profile.addRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.profile.addRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    );
  },
});

// Network gating matrix: profile.removeRelationship sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('profile.removeRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.profile.removeRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
    );
  },
});

// Network gating matrix: profile.getRelationships sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('profile.getRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.profile.getRelationships({ types: ['following'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.profile.getRelationships({ types: ['following'] }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.profile.getRelationships({ types: ['following'] }),
    );
  },
});
