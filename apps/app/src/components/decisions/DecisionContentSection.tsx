import { Suspense } from 'react';
import { Skeleton } from '@op/ui/Skeleton';

import { DecisionInstanceContent } from '@/components/decisions/DecisionInstanceContent';

interface DecisionContentSectionProps {
  instanceId: string;
}

function DecisionContentSkeleton() {
  return (
    <div className="min-h-full px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4">
        <div className="flex flex-col gap-2 text-center">
          {/* Title skeleton */}
          <Skeleton className="mx-auto h-12 w-96" />

          {/* Description skeleton */}
          <div className="mt-4 space-y-2">
            <Skeleton className="mx-auto h-4 w-full max-w-2xl" />
            <Skeleton className="mx-auto h-4 w-3/4 max-w-xl" />
            <Skeleton className="mx-auto h-4 w-5/6 max-w-lg" />
          </div>

          {/* Member avatars skeleton */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="size-8 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex w-full justify-center">
          <div className="flex w-full max-w-md flex-col items-center justify-center gap-4 sm:flex-row">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DecisionContentSection({ instanceId }: DecisionContentSectionProps) {
  return (
    <Suspense fallback={<DecisionContentSkeleton />}>
      <DecisionInstanceContent instanceId={instanceId} />
    </Suspense>
  );
}