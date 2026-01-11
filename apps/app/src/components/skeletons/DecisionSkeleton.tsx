import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton for decision page headers.
 * Matches the DecisionHeader + stepper layout.
 */
export const DecisionHeaderSkeleton = () => {
  return (
    <div className="bg-neutral-offWhite">
      {/* Header skeleton */}
      <div className="border-neutral-gray1 flex items-center justify-between border-b bg-white px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Stepper skeleton */}
      <div className="flex flex-col overflow-x-auto sm:items-center">
        <div className="border-neutral-gray1 w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
          <div className="mx-auto flex items-center justify-center space-x-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="mt-3 h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Full page skeleton for decision pages.
 * Includes header, hero, action bar, and content area.
 */
export const DecisionPageSkeleton = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <DecisionHeaderSkeleton />

      {/* Content area */}
      <div className="bg-neutral-offWhite min-h-full pt-8">
        <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4">
          {/* Hero skeleton */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>

          {/* Face pile skeleton */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-8 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Action bar skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        {/* Proposals section skeleton */}
        <div className="border-neutral-gray1 mt-8 flex w-full justify-center border-t bg-white">
          <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
