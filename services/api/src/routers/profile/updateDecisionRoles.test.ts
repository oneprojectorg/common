import { expect } from 'vitest';

import {
  describeGating,
  expectPassesAuthGate,
} from '../../test/helpers/gating';

const decisionPermissions = {
  delete: false,
  update: false,
  read: false,
  create: false,
  admin: false,
  inviteMembers: false,
  review: false,
  submitProposals: false,
  vote: false,
};

// Network gating matrix: profile.updateDecisionRoles sits on
// commonAuthedProcedure, which rejects no-JWT and anon-JWT at the auth
// middleware. A normal authenticated caller is admitted.
describeGating('profile.updateDecisionRoles', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expect(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwt: async ({ callers }) => {
    const caller = await callers.freshJwt();
    await expectPassesAuthGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    );
  },
});
