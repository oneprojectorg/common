'use client';

import { Skeleton } from '@op/sense/Skeleton';
import dynamic from 'next/dynamic';

/**
 * Client-only handle to {@link MapCanvas}. `ssr: false` keeps `maplibre-gl` out
 * of the server bundle entirely — it is fetched and compiled on the client only
 * when a location field actually mounts.
 */
export const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full sm:h-80" />,
});
