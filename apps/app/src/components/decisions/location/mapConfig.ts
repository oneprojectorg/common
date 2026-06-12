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
