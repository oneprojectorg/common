'use client';

import { Suspense } from 'react';
import { MapViewProfiles } from '@/components/MapView/MapViewProfiles';
import { Skeleton } from '@op/ui/Skeleton';
import { AppLayout } from '@/components/layout/split/AppLayout';

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 top-16 z-10 flex items-center justify-center bg-neutral-50">
          <Skeleton className="h-32 w-64" />
        </div>
      }
    >
      <AppLayout>
        <MapViewProfiles />
      </AppLayout>

    </Suspense>
  );
}