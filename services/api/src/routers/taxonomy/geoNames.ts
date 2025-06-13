import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const GeoNameSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  plusCode: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  countryCode: z.string(),
  countryName: z.string(),
});

type GeoName = z.infer<typeof GeoNameSchema>;

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
  getGeoNames: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // .meta(meta)
    .input(
      z.object({
        q: z.string().min(2).max(255),
      }),
    )
    .output(
      z.object({
        geonames: z
          .array(z.record(z.string(), GeoNameSchema))
          .optional()
          .default([]),
      }),
    )
    .query(async ({ input }) => {
      const { q } = input;

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
      }

      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Google Maps API error: ${data.error_message || response.statusText}`,
          );
        }

        const geoNameMap = new Map();

        if (data.results) {
          for (const place of data.results) {
            if (place.geometry?.location && place.formatted_address) {
              const countryComponent = place.address_components?.find(
                (component: any) => component.types.includes('country'),
              );

              const countryCode = countryComponent?.short_name || '';
              const countryName = countryComponent?.long_name || '';

              const geoName: GeoName = {
                address: place.formatted_address,
                name: place.name ?? place.formatted_address,
                plusCode: place.plus_code?.compound_code,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                id: place.place_id ?? Math.floor(Math.random() * 1000000),
                countryCode,
                countryName,
              };

              const key = `${geoName.name}`;
              geoNameMap.set(key, geoName);
            }
          }
        }

        const geonames = Array.from(geoNameMap).map((item) => ({
          [item[0]]: item[1],
        }));

        return {
          geonames,
        };
      } catch (error) {
        console.error('Maps API error:', error);
        return {
          geonames: [],
        };
      }
    }),
});
