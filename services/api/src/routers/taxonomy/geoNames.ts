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

// Collapse near-duplicate queries onto one cache key. Google's search is
// case-insensitive and trims surrounding whitespace, so "Main Street ",
// "main street", and "MAIN STREET" all produce the same result — caching them
// under the same key avoids paying for the same billable call multiple times.
const normalizeQuery = (q: string): string => q.trim().toLowerCase();

// Bumped when the cached value's shape changes. Previous entries cached the
// raw `GeoName[]` (or `[]` on transient Google errors); we now cache a
// discriminated `{ status: 'ok', geonames }` wrapper, so old entries must be
// orphaned rather than misinterpreted.
const CACHE_KEY_VERSION = 'v2';

/**
 * Result wrapper used by the cache fetcher so we can distinguish a transient
 * upstream failure (don't cache — would pin a wrong "no results" answer for
 * 72h) from a genuine empty result (cache — repeat queries for a nonsense
 * string should not re-hit Google).
 */
type GetGeonamesResult =
  | { status: 'ok'; geonames: GeoName[] }
  | { status: 'error' };

const getGeonames = async ({
  q,
  center,
}: {
  q: string;
  center?: { lat: number; lng: number };
}): Promise<GetGeonamesResult> => {
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

          // Key on the Google place id, not the display name: a query like
          // "Starbucks" returns many distinct Starbucks locations that all
          // share the same name, and a name-keyed map would collapse them into
          // one entry — so the user only sees a single business instead of the
          // list of nearby branches.
          geoNameMap.set(geoName.placeId, geoName);
        }
      }
    }

    const geonames = Array.from(geoNameMap).map((item) => item[1]);

    return { status: 'ok', geonames };
  } catch (e) {
    logger.error('Maps API error', { error: e });
    return { status: 'error' };
  }
};

export const getGeoNames = router({
  // Open to any authenticated caller (including anonymous participants) so the
  // proposal location picker's address search works for everyone who can reach
  // the picker — matches `reverseGeocode` and `resolveBoundary`. There is no
  // per-resource scope to assert: it forward-geocodes a free-text query against
  // a global provider. Billable-API abuse is bounded by the result cache, the
  // client-side debounce, and a procedure-level per-IP+endpoint rate limit
  // tighter than the default — Google Places `searchText` is metered per call,
  // so anonymous traffic gets a tighter quota than the standard 10/10s.
  getGeoNames: authenticatedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
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

      // Round the bias center for the cache key so small map nudges share a
      // cache entry; pass the raw center on to Google for the actual call.
      const roundedLat =
        center !== undefined ? roundCenterCoord(center.lat) : undefined;
      const roundedLng =
        center !== undefined ? roundCenterCoord(center.lng) : undefined;

      const result = await cache({
        type: 'geonames',
        params: [normalizeQuery(q), roundedLat, roundedLng, CACHE_KEY_VERSION],
        fetch: () => getGeonames({ q, center }),
        options: {
          // A transient Google failure returns `status: 'error'`; without this
          // predicate the cache would pin that empty result for 72h.
          skipCacheWrite: (r) => r.status === 'error',
        },
      });

      return {
        geonames: result.status === 'ok' ? result.geonames : [],
      };
    }),
});
