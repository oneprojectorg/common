'use client';

import { Suspense } from 'react';

import { Skeleton } from '@op/ui/Skeleton';

import { ProfilesMap } from '@/components/ProfilesMap';

function MapContent() {
  return (
    <div className="fixed inset-0 top-16 z-10" style={{ overflow: 'visible' }}>
      <ProfilesMap />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 top-16 z-10 flex items-center justify-center bg-neutral-50">
        <Skeleton className="h-32 w-64" />
      </div>
    }>
      <MapContent />
    </Suspense>
  );
}