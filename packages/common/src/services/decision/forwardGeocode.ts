import { cache } from '@op/cache';
import { logger } from '@op/logging';

export interface GeoName {
  id: string;
  placeId: string;
  name: string;
  address?: string;
  plusCode?: string;
  lat: number;
  lng: number;
  countryCode: string;
  countryName: string;
  metadata: unknown;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface PlaceResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  plusCode?: { compoundCode?: string };
  location?: { latitude: number; longitude: number };
  addressComponents?: Array<{
    types: string[];
    shortText?: string;
    longText?: string;
  }>;
}

const LOCATION_BIAS_RADIUS_METERS = 50_000;

const CENTER_CACHE_PRECISION = 2;

const roundCenterCoord = (value: number): number => {
  const factor = 10 ** CENTER_CACHE_PRECISION;
  return Math.round(value * factor) / factor;
};

const toGeoName = (place: PlaceResult): GeoName | null => {
  if (!place.location || !place.formattedAddress) {
    return null;
  }
  const country = place.addressComponents?.find((component) =>
    component.types.includes('country'),
  );
  const placeId = place.id ?? String(Math.floor(Math.random() * 1_000_000));

  return {
    id: placeId,
    placeId,
    name: place.displayName?.text ?? place.formattedAddress,
    address: place.formattedAddress,
    plusCode: place.plusCode?.compoundCode,
    lat: place.location.latitude,
    lng: place.location.longitude,
    countryCode: country?.shortText ?? '',
    countryName: country?.longText ?? '',
    metadata: place,
  };
};

const searchPlaces = async ({
  query,
  bias,
}: {
  query: string;
  bias?: GeoPoint;
}): Promise<GeoName[]> => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
  }

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.generativeSummary',
        },
        body: JSON.stringify({
          textQuery: query,
          ...(bias
            ? {
                locationBias: {
                  circle: {
                    center: { latitude: bias.lat, longitude: bias.lng },
                    radius: LOCATION_BIAS_RADIUS_METERS,
                  },
                },
              }
            : {}),
        }),
      },
    );
    const data: { places?: PlaceResult[]; error_message?: string } =
      await response.json();

    if (!response.ok) {
      throw new Error(
        `Google Maps API error: ${data.error_message || response.statusText}`,
      );
    }

    const byPlaceId = new Map<string, GeoName>();
    for (const place of data.places ?? []) {
      const geoName = toGeoName(place);
      if (geoName) {
        byPlaceId.set(geoName.placeId, geoName);
      }
    }

    return [...byPlaceId.values()];
  } catch (error) {
    logger.error('Maps API error', { error });
    return [];
  }
};

export async function forwardGeocode({
  query,
  bias,
}: {
  query: string;
  bias?: GeoPoint;
}): Promise<GeoName[]> {
  const roundedLat = bias ? roundCenterCoord(bias.lat) : undefined;
  const roundedLng = bias ? roundCenterCoord(bias.lng) : undefined;

  const places = await cache({
    type: 'geonames',
    params: [query, roundedLat, roundedLng],
    fetch: () => searchPlaces({ query, bias }),
  });

  return places ?? [];
}
