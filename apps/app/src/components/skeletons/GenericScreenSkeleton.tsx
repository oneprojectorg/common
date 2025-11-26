'use client';

import { Skeleton } from '@op/ui/Skeleton';

import { HeaderSkeleton } from './HomepageSkeleton';

/**
 * Generic screen skeleton with header and content area.
 * Used as fallback for routes without specific loading states.
 */
export const GenericScreenSkeleton = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <HeaderSkeleton />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
};
