'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';

/**
 * Skeleton for the homepage layout.
 * Used in loading.tsx and UserProvider Suspense fallback.
 */
export const HomepageSkeleton = () => {
  return (
    <div className="container flex min-h-0 grow flex-col gap-4 pt-8 sm:gap-10 sm:pt-14">
      {/* Welcome section skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="mx-auto h-10 w-80 sm:h-12 sm:w-96" />
        <Skeleton className="mx-auto h-5 w-64" />
      </div>

      {/* Platform highlights skeleton */}
      <Surface>
        <Skeleton className="h-52 w-full" />
      </Surface>

      <hr />

      {/* Feed section skeleton */}
      <div className="hidden grid-cols-15 sm:grid">
        <div className="col-span-9 flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <span />
        <div className="col-span-5">
          <Surface className="flex flex-col gap-6 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </Surface>
        </div>
      </div>

      {/* Mobile skeleton */}
      <div className="flex flex-col gap-4 sm:hidden">
        <Skeleton className="h-10 w-48" />
        <Surface className="flex flex-col gap-4 p-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Surface>
      </div>
    </div>
  );
};
