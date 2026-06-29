import { reverseGeocodeLocation } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

/**
 * A single reverse-geocoded place. Mirrors the `getGeoNames` result shape so
 * the location picker can treat forward search and reverse geocoding
 * interchangeably.
 */
const ReverseGeoNameSchema = z.object({
  placeId: z.string(),
  name: z.string().optional(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
});

export const reverseGeocode = router({
  // Open to any authenticated caller (including anonymous participants) so the
  // location picker can enrich a dropped pin with its address. No per-resource
  // scope to assert: it reverse-geocodes a coordinate against a global
  // provider. Billable-API abuse is bounded by the coordinate-rounded result
  // cache (see reverseGeocodeLocation) and a procedure-level per-IP+endpoint
  // rate limit tighter than the default — Google Geocoding is metered per
  // call, so anonymous traffic gets a tighter quota than the standard 10/10s.
  reverseGeocode: authenticatedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .output(
      z.object({
        geoname: ReverseGeoNameSchema.nullable(),
      }),
    )
    .query(async ({ input }) => {
      const geoname = await reverseGeocodeLocation({
        lat: input.lat,
        lng: input.lng,
      });

      return { geoname };
    }),
});
