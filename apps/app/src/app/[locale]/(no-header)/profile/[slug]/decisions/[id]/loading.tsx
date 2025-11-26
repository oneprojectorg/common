import { Skeleton } from '@op/ui/Skeleton';

/**
 * Loading skeleton for decision pages.
 * Matches the DecisionHeader + content layout.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <div className="border-b bg-neutral-offWhite">
        <div className="flex items-center justify-between border-b border-neutral-gray1 bg-white px-6 py-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        {/* Stepper skeleton */}
        <div className="flex flex-col overflow-x-auto sm:items-center">
          <div className="w-fit rounded-b border border-t-0 bg-white px-12 py-4 sm:px-32">
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
