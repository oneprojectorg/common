import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// One tier below the network gate: the right belongs to the account holder, and
// the service reads nothing but the caller's own rows. An anonymous sign-in has
// a `users` row but is not a data subject with a record to hand over.
describeAccessTierGating('account.exportPersonalData', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.account.exportPersonalData(),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.account.exportPersonalData(),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits an out-of-network account holder',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(caller.account.exportPersonalData());
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits an in-network account holder',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      await expectPassesAccessTierGate(caller.account.exportPersonalData());
    },
  ),
});
