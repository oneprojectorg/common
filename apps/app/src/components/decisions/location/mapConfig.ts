'use client';

import type { MapDefaultView } from '@op/common/client';
import type { LngLat } from '@op/sense/Map';
import { useEffect, useState } from 'react';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

const MAPTILER_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`
  : null;

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Build-time pick: MapTiler `streets-v4` when a key is configured, otherwise
 * OpenFreeMap's public `liberty` style. Both are MapLibre-compatible and the
 * OpenStreetMap attribution OpenFreeMap requires is added automatically by
 * MapLibre's default attribution control.
 */
const PRIMARY_STYLE_URL = MAPTILER_STYLE_URL ?? OPENFREEMAP_STYLE_URL;

/**
 * Runtime fallback target. `null` when OpenFreeMap is already primary — no
 * point falling back from OpenFreeMap to itself.
 */
const RUNTIME_FALLBACK_STYLE_URL = MAPTILER_STYLE_URL
  ? OPENFREEMAP_STYLE_URL
  : null;

/**
 * Memoizes the resolved style URL for the lifetime of the tab so every map on
 * the page agrees on which basemap to use after a single preflight. A failed
 * probe (network error / CORS) leaves the primary URL in place — one bad
 * round-trip shouldn't permanently demote a working MapTiler.
 */
let probePromise: Promise<string> | null = null;

function probeStyleUrl(): Promise<string> {
  if (probePromise) {
    return probePromise;
  }
  if (!RUNTIME_FALLBACK_STYLE_URL) {
    probePromise = Promise.resolve(PRIMARY_STYLE_URL);
    return probePromise;
  }
  // Use GET so the browser's HTTP cache holds the response — MapLibre's own
  // style fetch then comes from cache instead of round-tripping again. HEAD
  // would avoid the body but isn't reliably supported across CDNs.
  probePromise = fetch(PRIMARY_STYLE_URL, { method: 'GET' })
    .then((response) =>
      response.ok ? PRIMARY_STYLE_URL : RUNTIME_FALLBACK_STYLE_URL,
    )
    .catch(() => PRIMARY_STYLE_URL);
  return probePromise;
}

/**
 * Returns the basemap style URL, swapping to OpenFreeMap when the configured
 * MapTiler `style.json` returns a 4xx/5xx (quota exhausted, key revoked).
 * The probe runs at most once per tab — every consumer that calls this hook
 * gets the same resolved URL — so the `<Map>` component itself can stay
 * pure and only receive a single string.
 */
export function useMapStyleUrl(): string {
  const [styleUrl, setStyleUrl] = useState(PRIMARY_STYLE_URL);
  useEffect(() => {
    let cancelled = false;
    probeStyleUrl().then((resolved) => {
      if (!cancelled) {
        setStyleUrl(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return styleUrl;
}

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
