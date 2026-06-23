import { randomUUID } from 'node:crypto';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';

const input = { lat: 40.7128, lng: -74.006, profileId: randomUUID() };

// resolveBoundary is an `authenticatedProcedure`: only the editable picker calls
// it (composing a proposal requires a session — anonymous Supabase included), so
// any authenticated tier is admitted and only a no-JWT caller is rejected.
describeAccessTierGating('decision.resolveBoundary', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.resolveBoundary(input),
      'none',
    );
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
