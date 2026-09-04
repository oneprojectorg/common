import { Skeleton } from '@op/sense/Skeleton';

import { ProposalCardSkeleton } from './ProposalCardSkeleton';
import { ProposalMasonry } from './ProposalMasonry';

export { ProposalCardSkeleton } from './ProposalCardSkeleton';

// Reuse the real grid's masonry so the skeleton column count is identical to
// the resolved grid (a CSS grid reserves the gutter in its track sizing and
// undercounts by a column vs masonry). Masonry measures width in a layout
// effect: on the client (Suspense fallback, soft nav) it settles before paint;
// only a hard refresh of the route loading.tsx briefly shows the SSR default.
export const ProposalListSkeletonGrid = () => (
  <ProposalMasonry>
    {Array.from({ length: 10 }).map((_, index) => (
      <ProposalCardSkeleton key={index} />
    ))}
  </ProposalMasonry>
);

export const ProposalListSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* Filters Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <ProposalListSkeletonGrid />
    </div>
  );
};
