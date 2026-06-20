import { hasDecisionBoundaries, resolveBoundary } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

const resolveBoundaryInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const resolvedBoundaryEncoder = z.object({
  id: z.string(),
  name: z.string(),
  taxonomyTermId: z.string().nullable(),
});

const resolveBoundaryOutputSchema = z.object({
  boundary: resolvedBoundaryEncoder.nullable(),
  // Whether any boundaries are configured at all. The picker treats "no
  // boundaries" as "anywhere is valid", so the client needs to tell that case
  // apart from "outside the configured boundaries".
  boundariesConfigured: z.boolean(),
});

export const resolveBoundaryRouter = router({
  // Open (no JWT required): public, unauthenticated visitors viewing a proposal
  // need to see it on the map, and the read-only map view resolves the
  // containing boundary for the district badge. Boundaries are deployment-global
  // public data with no per-resource scope; the input is just a coordinate.
  // Abuse is bounded by the procedure rate limit.
  resolveBoundary: openProcedure()
    .input(resolveBoundaryInputSchema)
    .output(resolveBoundaryOutputSchema)
    .query(async ({ input }) => {
      const [boundary, boundariesConfigured] = await Promise.all([
        resolveBoundary({ lat: input.lat, lng: input.lng }),
        hasDecisionBoundaries(),
      ]);

      return { boundary, boundariesConfigured };
    }),
});
