import { Skeleton } from '@op/sense/Skeleton';

export function ProcessAdminOverviewSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-dvh flex-col bg-background">
      <div className="h-14 border-b bg-accent" />
      <div className="flex flex-col items-center gap-3 bg-muted px-4 pt-16 pb-8 md:px-6 md:pb-16">
        <Skeleton className="h-10 w-2/3 md:h-14 md:w-1/2" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-6 md:grid-cols-12 md:gap-x-12 md:px-6 md:py-12">
        <div className="flex flex-col gap-4 md:col-span-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-4 md:col-span-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
