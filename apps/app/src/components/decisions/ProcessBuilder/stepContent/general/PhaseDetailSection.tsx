'use client';

import { Suspense, useEffect, useState } from 'react';

import { Skeleton } from '@op/ui/Skeleton';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { PhaseDetailPage } from './PhaseDetailPage';

function PhaseDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-160 space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
    </div>
  );
}

export default function PhaseDetailSection(props: SectionProps) {
  const [hasHydrated, setHasHydrated] = useState(() =>
    useProcessBuilderStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <PhaseDetailSkeleton />;
  }

  return (
    <Suspense fallback={<PhaseDetailSkeleton />}>
      <PhaseDetailPage {...props} />
    </Suspense>
  );
}
