'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { Suspense, useEffect, useState } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { SummarySectionInner } from './SummarySectionInner';

function SummarySkeleton() {
  return (
    <div className="mx-auto w-full max-w-160 space-y-4 p-4 md:p-8">
      <div className="space-y-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <div className="rounded-lg border">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SummarySectionContent(props: SectionProps) {
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
    return <SummarySkeleton />;
  }

  return (
    <Suspense fallback={<SummarySkeleton />}>
      <SummarySectionInner {...props} />
    </Suspense>
  );
}
