import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';

export const ProposalListSkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <ProposalCardSkeleton key={index} />
    ))}
  </div>
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

const ProposalCardSkeleton = () => {
  return (
    <Surface className="relative w-full space-y-3 p-4 pb-4 md:min-w-80">
      {/* Header with title and budget skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      {/* Author and category skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-1 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Description skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Footer with engagement skeleton */}
      <div className="flex flex-col justify-between gap-4">
        <div className="flex w-full items-center justify-between gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    </Surface>
  );
};
