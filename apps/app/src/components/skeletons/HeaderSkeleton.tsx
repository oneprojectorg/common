'use client';

import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton for the site header.
 * Matches the SiteHeader layout structure.
 */
export const HeaderSkeleton = () => {
  return (
    <>
      {/* Desktop header */}
      <header className="gridCentered px-4 py-3 sm:grid hidden h-auto w-full items-center justify-between border-b border-offWhite">
        <div className="gap-3 flex items-center">
          <Skeleton className="size-8" />
          <Skeleton className="h-8 w-24" />
        </div>
        <span className="flex items-center justify-center">
          <Skeleton className="h-10 w-96" />
        </span>
        <div className="gap-3 flex items-center">
          <Skeleton className="size-8 rounded-full" />
        </div>
      </header>

      {/* Mobile header */}
      <header className="px-4 py-2 sm:hidden flex h-auto w-full items-center justify-between">
        <div className="gap-3 flex items-center">
          <Skeleton className="size-6" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="gap-3 flex items-center">
          <Skeleton className="size-4" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </header>
    </>
  );
};
