import { Skeleton } from '@op/sense/Skeleton';

export function ProcessAdminOverviewSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-dvh flex-col bg-background">
      <div className="h-14 border-b bg-accent" />
      <div className="flex flex-col items-center gap-3 bg-muted px-4 pt-16 pb-8 md:px-6 md:pb-16">
        <Skeleton className="h-10 w-2/3 md:h-14 md:w-1/2" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="mx-auto flex w-full max-w-272 flex-col gap-12 px-4 py-6 md:flex-row md:px-6 md:py-12 lg:gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <div className="flex min-w-0 flex-col gap-3 md:w-80 md:shrink-0 lg:w-140">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
