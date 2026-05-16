import { Skeleton } from '@op/ui/Skeleton';

import { ProposalListSkeleton } from '../decisions/ProposalsList';

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
    <div className="flex min-h-full flex-col gap-8 bg-neutral-offWhite py-8">
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
 * Full page skeleton for decision pages.
 * Includes header, hero, action bar, and content area.
 */
export const DecisionPageSkeleton = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <DecisionHeaderSkeleton />
      <div className="-mt-36 bg-neutral-offWhite">
        <DecisionContentSkeleton />

        {/* Proposals section skeleton */}
        <div className="mt-8 flex w-full justify-center border-t bg-white">
          <div className="w-full gap-8 p-4 sm:max-w-6xl sm:p-8">
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
              <ProposalListSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
