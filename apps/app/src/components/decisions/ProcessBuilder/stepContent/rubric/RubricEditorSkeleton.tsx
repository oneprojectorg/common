import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton loading state for the rubric criteria editor.
 */
export function RubricEditorSkeleton() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Main content skeleton */}
      <div className="flex-1 basis-1/2 p-4 md:p-8">
        <div className="mx-auto max-w-160 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>

          {/* Criterion card skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-6" />
                <Skeleton className="size-4" />
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}

          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      {/* Preview skeleton */}
      <div className="hidden basis-1/2 border-l p-4 md:block md:p-8">
        <div className="mx-auto max-w-120 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
