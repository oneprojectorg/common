import { Skeleton } from '@op/sense/Skeleton';

import { FilterBar, FilterBarEnd, FilterBarStart } from './FilterBar';
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

export const ProposalFilterBarSkeleton = () => (
  <FilterBar>
    <FilterBarStart>
      <Skeleton className="h-6 w-40" />
    </FilterBarStart>
    <FilterBarEnd>
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-10 w-32" />
    </FilterBarEnd>
  </FilterBar>
);

export const ProposalListSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      <ProposalFilterBarSkeleton />
      <ProposalListSkeletonGrid />
    </div>
  );
};
