import type { MapDefaultView } from '@op/common/client';
import type { LngLat } from '@op/ui/Map';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

/**
 * Basemap style URL. Prefers MapTiler `streets-v4` when a key is configured;
 * otherwise falls back to OpenFreeMap's public `liberty` style so the picker
 * still renders out of the box. Both styles are consumed by MapLibre via
 * `react-map-gl/maplibre`, which handles the OpenStreetMap attribution
 * required by OpenFreeMap automatically.
 */
export const MAP_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/liberty';

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
