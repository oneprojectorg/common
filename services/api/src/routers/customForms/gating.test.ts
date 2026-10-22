import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// One tier above `customForm.submit`: an anonymous session is refused at the
// gate, and only a confirmed account reaches the service layer's check.

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const DEFINITION = {
  type: 'object' as const,
  title: 'Gating probe',
  'x-phase': 'voting',
  required: [],
  properties: {
    answer: { type: 'string' as const, title: 'Answer' },
  },
  'x-field-order': ['answer'],
};

describeAccessTierGating('customForm.list', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.customForm.list({ profileId: NIL_UUID }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.customForm.list({ profileId: NIL_UUID }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.customForm.list({ profileId: NIL_UUID }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.customForm.list({ profileId: NIL_UUID }),
      );
    },
  ),
});

describeAccessTierGating('customForm.create', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.customForm.create({
        profileId: NIL_UUID,
        name: 'Probe',
        schema: DEFINITION,
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.customForm.create({
          profileId: NIL_UUID,
          name: 'Probe',
          schema: DEFINITION,
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.customForm.create({
          profileId: NIL_UUID,
          name: 'Probe',
          schema: DEFINITION,
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.customForm.create({
          profileId: NIL_UUID,
          name: 'Probe',
          schema: DEFINITION,
        }),
      );
    },
  ),
});

describeAccessTierGating('customForm.update', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.customForm.update({
        id: NIL_UUID,
        name: 'Probe',
        schema: DEFINITION,
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.customForm.update({
          id: NIL_UUID,
          name: 'Probe',
          schema: DEFINITION,
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.customForm.update({
          id: NIL_UUID,
          name: 'Probe',
          schema: DEFINITION,
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.customForm.update({
          id: NIL_UUID,
          name: 'Probe',
          schema: DEFINITION,
        }),
      );
    },
  ),
});

describeAccessTierGating('customForm.delete', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.customForm.delete({ id: NIL_UUID }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.customForm.delete({ id: NIL_UUID }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.customForm.delete({ id: NIL_UUID }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.customForm.delete({ id: NIL_UUID }),
      );
    },
  ),
});
