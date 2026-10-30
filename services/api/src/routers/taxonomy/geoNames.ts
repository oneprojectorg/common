import { forwardGeocode } from '@op/common';
import { list } from '@op/common/client';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

const GeoNameSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  name: z.string(),
  address: z.string().optional(),
  plusCode: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  countryCode: z.string(),
  countryName: z.string(),
  metadata: z.any(),
});

const CenterSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const getGeoNames = router({
  // Open to any authenticated caller (including anonymous participants) so the
  // proposal location picker's address search works for everyone who can reach
  // the picker — matches `reverseGeocode` and `resolveBoundary`. There is no
  // per-resource scope to assert: it forward-geocodes a free-text query against
  // a global provider. Billable-API abuse is bounded by the result cache, the
  // client-side debounce, and the procedure rate limit.
  getGeoNames: authenticatedProcedure()
    .input(
      z.object({
        q: z.string().min(2).max(255),
        /**
         * Optional center used as a `locationBias` so search prefers places
         * near this point (e.g. the proposal editor's map center). Omit for an
         * unbiased global search.
         */
        center: CenterSchema.optional(),
      }),
    )
    .output(list(GeoNameSchema))
    .query(async ({ input }) => ({
      items: await forwardGeocode({ query: input.q, bias: input.center }),
    })),
});
