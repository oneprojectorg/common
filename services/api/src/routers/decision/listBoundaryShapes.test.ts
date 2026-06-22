import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

// listBoundaryShapes is an `authenticatedProcedure`: only the editable picker
// calls it (composing a proposal requires a session — anonymous Supabase
// included), so any authenticated tier is admitted and only a no-JWT caller is
// rejected. Mirrors `resolveBoundary`'s gating since the two endpoints feed the
// same picker UI.
describeAccessTierGating('decision.listBoundaryShapes', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.listBoundaryShapes(),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.decision.listBoundaryShapes());
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.decision.listBoundaryShapes());
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.decision.listBoundaryShapes());
    },
  ),
});
