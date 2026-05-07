import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';

export function ReviewProposalCardSkeleton() {
  return (
    <Surface className="relative w-full min-w-80 space-y-3 p-4 pb-4">
      <Skeleton className="h-6 w-3/4" />

      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-1 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <Skeleton className="h-8 w-28 rounded-lg" />
    </Surface>
  );
}
