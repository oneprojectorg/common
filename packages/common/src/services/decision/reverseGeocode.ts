import { cache } from '@op/cache';

/**
 * A single reverse-geocoded place. Mirrors the `getGeoNames` result shape so the
 * location picker can treat forward search and reverse geocoding interchangeably.
 */
export interface ReverseGeoName {
  placeId: string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  countryCode?: string;
  countryName?: string;
}

/**
 * Result wrapper so the cache fetcher can distinguish a transient upstream
 * failure (don't cache — would pin a wrong "no address" answer for 72h) from
 * an addressless point like open water (cache — re-asking is pointless).
 */
type ReverseGeocodeResult =
  | { status: 'ok'; place: ReverseGeoName | null }
  | { status: 'error' };

const reverseGeocodePoint = async ({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<ReverseGeocodeResult> => {
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
    // bare coordinate. This is a genuine "no result" (status OK / ZERO_RESULTS)
    // and gets cached so repeat lookups of an addressless point don't re-hit
    // the billable API.
    if (!place) {
      return { status: 'ok', place: null };
    }

    const countryComponent = place.address_components?.find(
      (component: { types: string[] }) => component.types.includes('country'),
    );

    return {
      status: 'ok',
      place: {
        placeId: place.place_id,
        address: place.formatted_address,
        lat: place.geometry?.location?.lat ?? lat,
        lng: place.geometry?.location?.lng ?? lng,
        countryCode: countryComponent?.short_name,
        countryName: countryComponent?.long_name,
      },
    };
  } catch (e) {
    console.error('Reverse geocoding error', e);
    return { status: 'error' };
  }
};

// ~1.1m at the equator. Pins within this radius reverse-geocode to the same
// place, so we collapse them onto one cache key — otherwise an attacker could
// vary a coordinate by sub-meter deltas to bypass the cache and run up billable
// Google calls.
const GEOCODE_CACHE_PRECISION = 5;

// Bumped when the cached value's shape changes. Previous entries cached a
// `ReverseGeoName | null`; we now cache a discriminated wrapper, so old
// entries must be orphaned rather than misinterpreted.
const CACHE_KEY_VERSION = 'v2';

const roundCoordinate = (value: number): number => {
  const factor = 10 ** GEOCODE_CACHE_PRECISION;
  return Math.round(value * factor) / factor;
};

/**
 * Reverse-geocodes a coordinate to its nearest place via the Google Geocoding
 * API, or null when the point has no address (open water, etc.). Results are
 * cached by coordinate (rounded to ~1m). Powers the location picker's pin-drop
 * enrichment.
 */
export async function reverseGeocodeLocation({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<ReverseGeoName | null> {
  const roundedLat = roundCoordinate(lat);
  const roundedLng = roundCoordinate(lng);

  const result = await cache({
    type: 'reverseGeocode',
    params: [roundedLat, roundedLng, CACHE_KEY_VERSION],
    options: {
      // A transient Google failure returns `status: 'error'`; without this
      // predicate the cache would pin that empty result for 72h. Open-water /
      // desert points return `status: 'ok', place: null` — the wrapper object
      // is truthy, so the cache stores it without needing `storeNulls`, and
      // repeat lookups of an addressless point still skip the billable API.
      skipCacheWrite: (r) => r.status === 'error',
    },
    fetch: () => reverseGeocodePoint({ lat: roundedLat, lng: roundedLng }),
  });

  return result.status === 'ok' ? result.place : null;
}
