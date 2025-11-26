import { Skeleton } from '@op/ui/Skeleton';

/**
 * Generic loading skeleton for all routes under [locale].
 * Specific route groups like (main) can override with their own loading.tsx.
 */
export default function Loading() {
  return (
    <div className="container flex min-h-0 grow flex-col gap-6 pt-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
