'use client';

import { Skeleton } from '@op/ui/Skeleton';
import { cn } from '@op/ui/utils';

// The drop placeholder: a single card-sized box shown while dragging a
// file/link over a collection and while the dropped resource uploads. Reuses
// the shared Skeleton (pulse + neutral fill) so the treatment stays consistent
// app-wide; here it's just sized to a ResourceCard.
export const ResourceCardSkeleton = ({ className }: { className?: string }) => {
  return <Skeleton className={cn('h-64 w-full rounded-lg', className)} />;
};
