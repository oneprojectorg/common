import { resolveBoundary } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

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
});

export const resolveBoundaryRouter = router({
  // Open to any authenticated caller (including anonymous participants) so the
  // location picker can show the live council-district badge while composing a
  // proposal. Boundaries are deployment-global, so there is no per-resource
  // scope to assert; the input is just a coordinate. Abuse is bounded by the
  // procedure rate limit.
  resolveBoundary: authenticatedProcedure()
    .input(resolveBoundaryInputSchema)
    .output(resolveBoundaryOutputSchema)
    .query(async ({ input }) => {
      const boundary = await resolveBoundary({
        lat: input.lat,
        lng: input.lng,
      });

      return { boundary };
    }),
});
