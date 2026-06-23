import { hasDecisionBoundaries, resolveBoundary } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

const resolveBoundaryInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  profileId: z.string().uuid(),
});

const resolvedBoundaryEncoder = z.object({
  id: z.string(),
  name: z.string(),
  taxonomyTermId: z.string().nullable(),
});

const resolveBoundaryOutputSchema = z.object({
  boundary: resolvedBoundaryEncoder.nullable(),
  // Whether any boundaries are configured for this profile at all. The picker
  // treats "no boundaries" as "anywhere is valid", so the client needs to tell
  // that case apart from "outside the configured boundaries".
  boundariesConfigured: z.boolean(),
});

export const resolveBoundaryRouter = router({
  // Only the editable location picker calls this — to flag out-of-area pin
  // placements live as a participant composes a proposal. Composing requires
  // an authenticated session (anonymous Supabase sessions included), so this
  // stays at `authenticatedProcedure`. Read-only proposal views show the
  // district from the persisted category, so they need no boundary lookup.
  // Scoped by `profileId` (== `processInstances.profileId`) so each decision
  // sees only its own boundary set.
  resolveBoundary: authenticatedProcedure()
    .input(resolveBoundaryInputSchema)
    .output(resolveBoundaryOutputSchema)
    .query(async ({ input }) => {
      const [boundary, boundariesConfigured] = await Promise.all([
        resolveBoundary({
          lat: input.lat,
          lng: input.lng,
          profileId: input.profileId,
        }),
        hasDecisionBoundaries({ profileId: input.profileId }),
      ]);

      return { boundary, boundariesConfigured };
    }),
});
