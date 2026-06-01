import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

describeGating('organization.addRelationship', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.organization.addRelationship({
        to: '00000000-0000-0000-0000-000000000000',
        relationships: [],
      }),
    );
  },
});
