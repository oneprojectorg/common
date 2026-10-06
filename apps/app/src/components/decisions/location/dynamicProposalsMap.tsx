import { ClientOnly } from '@/utils/ClientOnly';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, lazy } from 'react';

import type { ProposalsMapCanvasProps } from './ProposalsMapCanvas';

const LazyProposalsMapCanvas = lazy(() => import('./ProposalsMapCanvas'));

/**
 * Client-only handle to {@link LazyProposalsMapCanvas}. Rendering only after
 * mount keeps `maplibre-gl` out of the server render entirely — it is fetched
 * and compiled on the client only when the proposals map view actually mounts.
 */
export const ProposalsMapCanvas = (props: ProposalsMapCanvasProps) => {
  const fallback = <Skeleton className="h-full w-full" />;

  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyProposalsMapCanvas {...props} />
      </Suspense>
    </ClientOnly>
  );
};
