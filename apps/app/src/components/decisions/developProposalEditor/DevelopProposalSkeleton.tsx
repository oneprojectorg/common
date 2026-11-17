import { Skeleton, SkeletonText } from '@op/sense/Skeleton';

/** The develop editor while it loads: the header and both panes. */
export function DevelopProposalSkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <Skeleton className="h-5 w-16" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
      {/* Same widths and padding as the SplitPane in DevelopProposalFrame. */}
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1">
        <div className="hidden min-w-0 flex-1 border-e p-12 ps-6 pt-8 sm:block">
          <DevelopOriginSkeleton />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-8 px-6 pt-8 pb-4 sm:p-12 sm:pe-6 sm:pt-8">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-40" />
            <SkeletonText lines={2} />
          </div>
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton tall />
        </div>
      </div>
    </div>
  );
}

export function DevelopOriginSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-8 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <SkeletonText lines={6} />
    </div>
  );
}

function FieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={tall ? 'h-40 w-full' : 'h-11 w-full'} />
    </div>
  );
}
