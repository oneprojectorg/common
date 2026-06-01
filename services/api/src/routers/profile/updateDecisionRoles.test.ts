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

describeGating('profile.updateDecisionRoles', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expect(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
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
      cause: { name: 'AuthGateError' },
    });
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expect(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesAuthGate(
      caller.profile.updateDecisionRoles({
        roleId: '00000000-0000-0000-0000-000000000000',
        decisionPermissions,
      }),
    );
  },
});
