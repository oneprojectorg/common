'use client';

import { cn } from '@op/ui/utils';

// A single gray box the size and shape of a ResourceCard, used as the drop
// target indicator while dragging a file/link over a collection and while the
// dropped resource uploads/creates. Deliberately plain — no inner skeleton
// lines — so it reads as "a card will land here".
export const ResourceCardSkeleton = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        'h-64 w-full animate-pulse rounded-lg bg-neutral-gray1',
        className,
      )}
      aria-hidden
    />
  );
};
