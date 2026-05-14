import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';

/**
 * Single proposal card skeleton — matches ProposalCard shape.
 */
export const ProposalCardSkeleton = () => {
  return (
    <Surface className="relative w-full min-w-80 space-y-3 p-4 pb-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-1 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

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

/**
 * 3-column proposal grid skeleton (without filter bar).
 */
export const ProposalListSkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <ProposalCardSkeleton key={index} />
    ))}
  </div>
);

/**
 * Full proposal list skeleton — filter bar + 3-column grid.
 * Used by both the route-level loading.tsx and in-page Suspense fallbacks
 * so users don't see a layout flash between them.
 */
export const ProposalListSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
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

/**
 * Skeleton for the full proposal detail page — header (mirrors
 * ProposalViewLayout) plus body (mirrors ProposalPreview + content). Shape
 * matches the live layout so the swap to real content barely shifts.
 */
export const ProposalViewSkeleton = () => {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header — mirrors ProposalViewLayout */}
      <div className="grid grid-cols-3 items-center border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded sm:size-4" />
          <Skeleton className="hidden h-4 w-32 sm:block" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex items-center justify-end gap-4">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="hidden size-8 rounded-full sm:block" />
        </div>
      </div>

      {/* Body — mirrors ProposalPreview */}
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto flex max-w-xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            {/* Title */}
            <Skeleton className="h-10 w-3/4" />

            <div className="space-y-6">
              {/* Metadata row: budget + categories */}
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-7 w-24 rounded-md" />
              </div>

              {/* Author and submission info */}
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>

              {/* Engagement Stats */}
              <div className="flex items-center gap-4 border-t border-b py-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Body text lines */}
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for the comments section under a proposal. Header + comment
 * input surface + a couple of comment-item placeholders.
 */
export const ProposalCommentsSkeleton = () => {
  return (
    <div className="border-t pt-8">
      <Skeleton className="mb-6 h-6 w-32" />

      <div className="mb-8">
        <Surface className="border-0 p-0 sm:border sm:p-4">
          <Skeleton className="h-24 w-full" />
        </Surface>
      </div>

      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
