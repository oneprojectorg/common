import { Skeleton } from '@op/sense/Skeleton';
import type { ReactNode } from 'react';

import { AssignmentsMain } from './AssignmentsPageShell';

export function ReviewersTableSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ReviewerHeaderSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}

export function ReviewerAssignmentsBodySkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

// The Back control is a placeholder: loading.tsx gets no params to link back with.
export function ReviewAssignmentsPageSkeleton() {
  return (
    <PageShellSkeleton>
      <Skeleton className="h-9 w-64" />
      <ReviewersTableSkeleton />
    </PageShellSkeleton>
  );
}

export function ReviewerAssignmentsPageSkeleton() {
  return (
    <PageShellSkeleton>
      <ReviewerHeaderSkeleton />
      <ReviewerAssignmentsBodySkeleton />
    </PageShellSkeleton>
  );
}

function PageShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AssignmentsMain>
        <div className="flex h-9 items-center">
          <Skeleton className="h-5 w-16" />
        </div>
        {children}
      </AssignmentsMain>
    </div>
  );
}
