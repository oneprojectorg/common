'use client';

import { Skeleton } from '@op/sense/Skeleton';
import dynamic from 'next/dynamic';

/**
 * Client-only handle to {@link ProposalsMapCanvas}. `ssr: false` keeps
 * `maplibre-gl` out of the server bundle entirely — it is fetched and compiled
 * on the client only when the proposals map view actually mounts.
 */
export const ProposalsMapCanvas = dynamic(
  () => import('./ProposalsMapCanvas'),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);
