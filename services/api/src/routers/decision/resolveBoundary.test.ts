import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

const input = { lat: 40.7128, lng: -74.006 };

// resolveBoundary is an `openProcedure`: public, unauthenticated viewers must be
// able to resolve a proposal's boundary to render it on the map, so every tier
// — including no-JWT — is admitted past the gate.
describeAccessTierGating('decision.resolveBoundary', {
  noJwt: accessTierGatingCell('admits no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.decision.resolveBoundary(input));
    },
  ),
});
