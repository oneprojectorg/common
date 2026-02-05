'use client';

import { Skeleton } from '@op/ui/Skeleton';

export function PhasesSectionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-160 space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-5 w-72" />

      {/* Phase accordion skeletons */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2"
          >
            <Skeleton className="size-6" />
            <Skeleton className="size-4" />
            <Skeleton className="h-7 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
