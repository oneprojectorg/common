import { ClientOnly } from '@/utils/ClientOnly';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, lazy } from 'react';

import type { MapCanvasProps } from './MapCanvas';

const LazyMapCanvas = lazy(() => import('./MapCanvas'));

/**
 * Client-only handle to {@link LazyMapCanvas}. Rendering only after mount keeps
 * `maplibre-gl` out of the server render entirely — it is fetched and compiled
 * on the client only when a location field actually mounts.
 */
export const MapCanvas = (props: MapCanvasProps) => {
  const fallback = <Skeleton className="h-44 w-full sm:h-80" />;

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyMapCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
};
