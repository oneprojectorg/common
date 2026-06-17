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
  reverseGeocode: authenticatedProcedure()
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
