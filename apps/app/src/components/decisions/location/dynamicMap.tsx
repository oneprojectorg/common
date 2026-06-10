'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only handle to {@link MapCanvas}. `ssr: false` keeps `maplibre-gl` out
 * of the server bundle entirely — it is fetched and compiled on the client only
 * when a location field actually mounts.
 */
export const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="h-44 sm:h-80 w-full animate-pulse border border-neutral-gray1 bg-neutral-gray1" />
  ),
});
