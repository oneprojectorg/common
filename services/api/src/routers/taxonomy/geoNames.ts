import { cache } from '@op/cache';
import { logger } from '@op/logging';
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

type GeoName = z.infer<typeof GeoNameSchema>;

const CenterSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Radius for the `locationBias` circle sent to Google Places. 50 km covers a
// metro area, which matches the proposal editor's "search near the map center"
// intent — without being so tight that a user's free-text query for a known
// landmark just outside the city center returns no result.
const LOCATION_BIAS_RADIUS_METERS = 50_000;

// Cache-key precision for the bias center. ~1.1 km at the equator: fine enough
// that two distinct metro areas don't collide, coarse enough that small map
// nudges (drag, marker move) still share a cache entry instead of paying a
// billable API call per pixel.
const CENTER_CACHE_PRECISION = 2;

const roundCenterCoord = (value: number): number => {
  const factor = 10 ** CENTER_CACHE_PRECISION;
  return Math.round(value * factor) / factor;
};

/**
 * Normalizes a free-text query for use as a cache key — trim surrounding
 * whitespace and lowercase. Collapses "Main Street", "main street", and
 * " MAIN STREET " onto one cache entry instead of paying three billable Google
 * calls. The original query is still sent to Google verbatim so the API sees
 * exactly what the user typed.
 */
export const normalizeQueryForCacheKey = (q: string): string =>
  q.trim().toLowerCase();

/**
 * Calls Google Places searchText for a free-text query, optionally biased
 * toward a map center. Returns the mapped places (empty array when Google
 * returns no results) and THROWS on Google API errors or network failures, so
 * the {@link cache} wrapper does not store the failure as an empty result —
 * which would poison the cache for 72h and surface "No results" to subsequent
 * users even after Google recovers.
 */
export const fetchPlacesFromGoogle = async ({
  q,
  center,
}: {
  q: string;
  center?: { lat: number; lng: number };
}): Promise<GeoName[]> => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
  }

  const url = `https://places.googleapis.com/v1/places:searchText`;

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
      // Bias toward the caller-supplied map center so a participant in
      // Stockholm searching a Columbus, OH process still gets Columbus
      // results. Bias (not restriction) — distant matches are still allowed
      // when nothing nearby fits the query.
      ...(center
        ? {
            locationBias: {
              circle: {
                center: {
                  latitude: center.lat,
                  longitude: center.lng,
                },
                radius: LOCATION_BIAS_RADIUS_METERS,
              },
            },
          }
        : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Google Maps API error: ${data.error_message || response.statusText}`,
    );
  }

  const geoNameMap = new Map<string, GeoName>();

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

        // Key on the Google place id, not the display name: a query like
        // "Starbucks" returns many distinct Starbucks locations that all
        // share the same name, and a name-keyed map would collapse them into
        // one entry — so the user only sees a single business instead of the
        // list of nearby branches.
        geoNameMap.set(geoName.placeId, geoName);
      }
    }
  }

  return Array.from(geoNameMap.values());
};

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
    .output(
      z.object({
        geonames: z.array(GeoNameSchema).optional().prefault([]),
      }),
    )
    .query(async ({ input }) => {
      const { q, center } = input;
      const normalizedQ = normalizeQueryForCacheKey(q);

      // Round the bias center for the cache key so small map nudges share a
      // cache entry; pass the raw center on to Google for the actual call.
      const roundedLat =
        center !== undefined ? roundCenterCoord(center.lat) : undefined;
      const roundedLng =
        center !== undefined ? roundCenterCoord(center.lng) : undefined;

      try {
        const geonames = await cache({
          type: 'geonames',
          // Use the normalized query for the cache key only — pass the raw
          // query to Google so the API sees exactly what the user typed.
          params: [normalizedQ, roundedLat, roundedLng],
          fetch: () => fetchPlacesFromGoogle({ q, center }),
        });

        return { geonames };
      } catch (e) {
        // `fetchPlacesFromGoogle` throws on Google API errors / network
        // failures, which propagates through `cache()` without writing —
        // so the empty-result fallback stays in this request only and the
        // next call retries Google instead of serving a poisoned cache.
        // The user-facing behavior matches the pre-change "show no results"
        // experience; the logged error keeps the outage visible in metrics.
        logger.error('getGeoNames: Places search failed', {
          error: e,
          query: normalizedQ,
        });
        return { geonames: [] };
      }
    }),
});
