import type { MapDefaultView } from '@op/common/client';
import type { LngLat } from '@op/ui/Map';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

/**
 * MapTiler style URL, or `null` when no key is configured (the
 * picker renders a graceful "map unavailable" message in that case).
 */
export const MAP_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`
  : null;

/** Fallback camera target before a location is chosen (Bexley, OH). */
export const DEFAULT_MAP_CENTER: LngLat = { lng: -82.9371, lat: 39.9686 };

/**
 * Starting camera for the Location field's "Map view" config before an admin
 * has positioned it: the whole globe, centered on Columbus, OH.
 *
 * TODO: A better UX would be to geolocate and center the map on the user.
 */
export const DEFAULT_LOCATION_FIELD_MAP_VIEW: MapDefaultView = {
  center: { lng: -82.9988, lat: 39.9612 },
  zoom: 1,
};
