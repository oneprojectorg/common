import { Skeleton } from '@op/ui/Skeleton';

import { ProposalListSkeleton } from '../decisions/ProposalListSkeleton';

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
  return (
    <div className="flex min-h-full flex-col gap-8 bg-neutral-offWhite pt-8">
      <div className="mx-auto flex max-w-3xl flex-col justify-center gap-4 px-4">
        {/* Hero skeleton */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Skeleton className="h-12 w-3/4 sm:h-14" />
          <Skeleton className="h-5 w-1/2" />
        </div>

        {/* Action bar skeleton */}
        <div className="flex w-full justify-center">
          <div className="flex w-full max-w-[12rem] flex-col items-center justify-center gap-4 sm:max-w-md sm:flex-row">
            <Skeleton className="h-10 w-full sm:w-40" />
            <Skeleton className="h-10 w-full sm:w-40" />
          </div>
        </div>
      </div>
      <div className="border-t bg-white">
        <div className="mx-auto bg-white p-4 sm:max-w-6xl sm:p-8">
          <ProposalListSkeleton />
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
        <div className="flex justify-center">
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
        <div className="flex items-center justify-end gap-2 md:gap-4">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </header>
  );
};

/**
 * Skeleton for the decision overview tab. Mirrors DecisionOverview's real
 * layout — full-bleed hero band, then the 12-col grid with the phase timeline
 * sidebar and the About body — so the resolved page lands without a layout
 * shift.
 */
export const OverviewSkeleton = () => {
  return (
    <div className="flex w-full flex-col">
      {/* Hero band: title, meta row, subhead, CTA chips */}
      <div className="border-b bg-neutral-offWhite">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 pt-16 pb-8 text-center md:px-6 md:pb-16">
          <div className="flex w-full flex-col items-center gap-3">
            <Skeleton className="h-12 w-3/4 sm:h-14" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-1/2" />
          </div>
          <div className="flex w-full flex-col items-center gap-4 md:flex-row md:justify-center">
            <Skeleton className="h-10 w-full md:w-40" />
            <Skeleton className="h-10 w-full md:w-40" />
          </div>
        </div>
      </div>
      {/* Sidebar (phase timeline) + About body grid */}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 px-4 py-6 md:grid-cols-12 md:gap-x-6 md:px-6 md:py-12">
        <div className="flex flex-col gap-4 md:col-span-4">
          <Skeleton className="h-4 w-32" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3 md:col-span-7 md:col-start-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
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
      <div className="-mt-36 bg-neutral-offWhite">
        <DecisionContentSkeleton />
      </div>
    </div>
  );
};
