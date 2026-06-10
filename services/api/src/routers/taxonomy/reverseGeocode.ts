import { cache } from '@op/cache';
import { logger } from '@op/logging';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

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

type ReverseGeoName = z.infer<typeof ReverseGeoNameSchema>;

const reverseGeocodePoint = async ({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<ReverseGeoName | null> => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (
      !response.ok ||
      (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')
    ) {
      throw new Error(
        `Google Geocoding API error: ${data.error_message || data.status || response.statusText}`,
      );
    }

    const place = data.results?.[0];

    // Open water, deserts, etc. return no address — the caller falls back to a
    // bare coordinate.
    if (!place) {
      return null;
    }

    const countryComponent = place.address_components?.find(
      (component: { types: string[] }) => component.types.includes('country'),
    );

    return {
      placeId: place.place_id,
      address: place.formatted_address,
      lat: place.geometry?.location?.lat ?? lat,
      lng: place.geometry?.location?.lng ?? lng,
      countryCode: countryComponent?.short_name,
      countryName: countryComponent?.long_name,
    };
  } catch (e) {
    logger.error('Reverse geocoding error', { error: e });
    return null;
  }
};

export const reverseGeocode = router({
  reverseGeocode: networkAuthenticatedProcedure()
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
      const { lat, lng } = input;

      const geoname = await cache({
        type: 'reverseGeocode',
        params: [lat, lng],
        fetch: () => reverseGeocodePoint({ lat, lng }),
      });

      return { geoname };
    }),
});
