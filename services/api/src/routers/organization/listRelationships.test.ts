import {
  describeAccessTierGating,
  expectFailsTierGate,
  expectPassesTierGate,
} from '../../test/helpers/gating';

describeAccessTierGating('organization.listPendingRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.organization.listPendingRelationships(),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.organization.listPendingRelationships(),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.organization.listPendingRelationships(),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(caller.organization.listPendingRelationships());
  },
});

describeAccessTierGating('organization.listDirectedRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.organization.listDirectedRelationships({
        from: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});

describeAccessTierGating('organization.listRelationships', {
  noJwt: async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsTierGate(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'none',
    );
  },

  anonJwt: async ({ callers }) => {
    const caller = await callers.anonJwt();
    await expectFailsTierGate(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'anon',
    );
  },

  userJwt: async ({ callers }) => {
    const caller = await callers.userJwt();
    await expectFailsTierGate(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
      'user',
    );
  },

  networkJwt: async ({ callers }) => {
    const caller = await callers.networkJwt();
    await expectPassesTierGate(
      caller.organization.listRelationships({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  },
});
