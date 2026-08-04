import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton for decision page headers.
 * Matches the DecisionHeader + stepper layout.
 */
export const DecisionHeaderSkeleton = () => {
  return (
    <div className="bg-neutral-offWhite pb-40">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-6 w-48" />

        <div className="flex items-center gap-4">
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Stepper skeleton */}
      <div className="flex flex-col overflow-x-auto sm:items-center">
        <div className="w-fit rounded-b border border-t-0 bg-white px-12 pt-4 pb-7 sm:px-24">
          <div className="mx-auto flex items-center justify-center gap-16">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="mt-1 min-h-3 w-24" />
                <Skeleton className="min-h-2 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for the decision page body below the stepper.
 * Matches the hero + face pile + action bar layout rendered
 * by DecisionStateRouter once instance data resolves.
 */
export const DecisionContentSkeleton = () => {
  // Hero + action bar only — no proposal grid. The grid's column count depends
  // on measured width (ProposalMasonry), which SSR can't know, so rendering it
  // here would flash the wrong count on hard refresh. The page's own Suspense
  // fallback (ProposalListSkeleton) draws the one, correctly-measured grid.
  return (
    <div className="grid w-full grid-cols-1 justify-center border-b bg-neutral-offWhite md:grid-cols-12">
      <div className="mx-auto flex w-full flex-col items-center gap-4 px-4 pt-16 pb-8 text-center md:col-span-6 md:col-start-4 md:px-6 md:pb-16">
        <div className="flex w-full flex-col items-center gap-3">
          <Skeleton className="h-8 w-3/4 md:h-14" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <div className="flex w-full flex-col items-center gap-4 md:flex-row md:justify-center">
          <Skeleton className="h-10 w-full md:w-40" />
          <Skeleton className="h-10 w-full md:w-40" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for the decision header bar only (no stepper). Mirrors
 * DecisionInstanceHeader's fixed-height sticky bar so the real header swaps in
 * without shifting the layout: same sticky/border/height classes, with chips
 * where the back link, view toggle, and user controls land.
 */
export const DecisionHeaderBarSkeleton = () => {
  return (
    <header className="sticky top-0 z-30 border-b bg-white">
      <div className="grid h-12 grid-cols-[auto_1fr_auto] items-center px-4 sm:grid-cols-3 md:h-14 md:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-6 rounded md:size-4" />
          <Skeleton className="hidden h-5 w-24 md:block" />
        </div>
        {/* Mobile centers the decision title (the toggle floats below the bar);
            md+ shows the view-toggle pill in the center column. */}
        <div className="flex justify-center">
          <Skeleton className="h-5 w-32 rounded md:h-8 md:w-44 md:rounded-full" />
        </div>
        <div className="flex items-center justify-end gap-2 md:gap-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </header>
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
      <div className="-mt-36 bg-neutral-offWhite">
        <DecisionContentSkeleton />
      </div>
    </div>
  );
};
