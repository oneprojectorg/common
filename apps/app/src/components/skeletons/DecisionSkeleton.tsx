import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton for decision page headers.
 * Matches the DecisionHeader + stepper layout.
 */
export const DecisionHeaderSkeleton = () => {
  return (
    <div className="bg-neutral-offWhite">
      {/* Header skeleton */}
      <div className="px-6 py-4 flex items-center justify-between border-b bg-white">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Stepper skeleton */}
      <div className="sm:items-center flex flex-col overflow-x-auto">
        <div className="px-12 py-4 sm:px-32 w-fit rounded-b border border-t-0 bg-white">
          <div className="space-x-8 mx-auto flex items-center justify-center">
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
      <div className="pt-8 min-h-full bg-neutral-offWhite">
        <div className="max-w-3xl gap-4 px-4 mx-auto flex flex-col justify-center">
          {/* Hero skeleton */}
          <div className="gap-2 flex flex-col">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>

          {/* Face pile skeleton */}
          <div className="gap-2 flex items-center">
            <div className="-space-x-2 flex">
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
        <div className="mt-8 flex w-full justify-center border-t bg-white">
          <div className="gap-8 p-4 sm:max-w-6xl sm:p-8 w-full">
            <div className="gap-4 flex flex-col">
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
