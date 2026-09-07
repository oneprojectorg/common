import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// This endpoint sits on `authenticatedConfirmedProcedure`, one tier below the
// network gate most of the API uses. The right belongs to the account holder
// rather than to a member of our closed network, so an out-of-network user must
// get through — the reason that is safe is that the service reads nothing but
// the caller's own rows, and takes no input through which it could be pointed
// elsewhere.
//
// The two rejected tiers are the point of the tier choice. An anonymous sign-in
// has a `users` row but is not a data subject with a record to hand over.
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
