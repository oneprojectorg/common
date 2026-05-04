import { Skeleton } from '@op/ui/Skeleton';

export function ReviewSummarySkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="mx-auto hidden min-h-0 w-full max-w-6xl flex-1 sm:flex">
        <div className="flex-1 border-r p-12">
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
        <div className="flex-1 px-12 pt-12">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
