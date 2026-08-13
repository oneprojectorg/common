'use client';

import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import type { SectionProps } from '../../contentRegistry';
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
  return (
    <Suspense fallback={<SummarySkeleton />}>
      <SummarySectionInner {...props} />
    </Suspense>
  );
}
