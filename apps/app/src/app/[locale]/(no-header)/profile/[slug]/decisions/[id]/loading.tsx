import { Skeleton } from '@op/ui/Skeleton';

import { DecisionHeaderSkeleton } from '@/components/skeletons/DecisionHeaderSkeleton';

/**
 * Loading skeleton for decision pages.
 * Matches the DecisionHeader + content layout.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <DecisionHeaderSkeleton />

      {/* Content skeleton */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
