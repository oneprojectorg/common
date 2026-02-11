import { Skeleton } from '@op/ui/Skeleton';

export function ProposalCategoriesSectionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-160 space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Category list items */}
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2 py-3">
            <Skeleton className="mt-0.5 size-4 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ))}
      </div>

      {/* Toggle rows */}
      <div className="space-y-4 border-t pt-6">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
