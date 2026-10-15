import { Skeleton } from '@op/sense/Skeleton';

export default function Loading() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-dvh flex-col gap-4 bg-background px-4 py-12 md:px-6"
    >
      <Skeleton className="h-10 w-2/3 md:h-14" />
      <Skeleton className="h-5 w-48" />
    </div>
  );
}
