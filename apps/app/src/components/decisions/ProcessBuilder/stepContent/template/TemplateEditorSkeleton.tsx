'use client';

import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton loading state shown while store is hydrating.
 */
export function TemplateEditorSkeleton() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar skeleton - desktop only */}
      <div className="hidden w-64 shrink-0 border-r p-4 md:block">
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="mb-2 h-4 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-160">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-6 h-5 w-72" />

          {/* Field card skeletons */}
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  );
}
