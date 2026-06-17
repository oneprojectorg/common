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
    console.error('Reverse geocoding error', e);
    return null;
  }
};

/**
 * Reverse-geocodes a coordinate to its nearest place via the Google Geocoding
 * API, or null when the point has no address (open water, etc.). Results are
 * cached by coordinate. Powers the location picker's pin-drop enrichment.
 */
export async function reverseGeocodeLocation({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<ReverseGeoName | null> {
  return cache({
    type: 'reverseGeocode',
    params: [lat, lng],
    fetch: () => reverseGeocodePoint({ lat, lng }),
  });
}
