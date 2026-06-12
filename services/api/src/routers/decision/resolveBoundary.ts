import { resolveBoundary } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

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
  resolveBoundary: networkAuthenticatedProcedure()
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
