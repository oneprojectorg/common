import { cache } from '@op/cache';
import { logger } from '@op/logging';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

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

type GeoName = z.infer<typeof GeoNameSchema>;

const getGeonames = async ({ q }: { q: string }) => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
  }

  const url = `https://places.googleapis.com/v1/places:searchText`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.generativeSummary',
      },
      body: JSON.stringify({
        textQuery: q,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Google Maps API error: ${data.error_message || response.statusText}`,
      );
    }

    const geoNameMap = new Map();

    if (data.places) {
      for (const place of data.places) {
        if (place.location && place.formattedAddress) {
          const countryComponent = place.addressComponents?.find(
            (component: any) => component.types.includes('country'),
          );

          const countryCode = countryComponent?.shortText || '';
          const countryName = countryComponent?.longText || '';

          const geoName: GeoName = {
            address: place.formattedAddress,
            name: place.displayName.text ?? place.formattedAddress,
            plusCode: place.plusCode?.compoundCode,
            lat: place.location.latitude,
            lng: place.location.longitude,
            id: place.id ?? Math.floor(Math.random() * 1000000),
            placeId: place.id ?? Math.floor(Math.random() * 1000000),
            countryCode,
            countryName,
            metadata: place,
          };

          const key = `${geoName.name}`;
          geoNameMap.set(key, geoName);
        }
      }
    }

    const geonames = Array.from(geoNameMap).map((item) => item[1]);

    return geonames;
  } catch (e) {
    logger.error('Maps API error', { error: e });
    return [];
  }
};

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'POST',
// path: '/organization',
// protect: true,
// tags: ['organization'],
// summary: 'Create organization',
// },
// };

export const getGeoNames = router({
  getGeoNames: commonAuthedProcedure
    .input(
      z.object({
        q: z.string().min(2).max(255),
      }),
    )
    .output(
      z.object({
        geonames: z.array(GeoNameSchema).optional().prefault([]),
      }),
    )
    .query(async ({ input }) => {
      const { q } = input;

      const geonames = await cache({
        type: 'geonames',
        params: [q],
        fetch: () => getGeonames({ q }),
      });

      return {
        geonames,
      };
    }),
});
