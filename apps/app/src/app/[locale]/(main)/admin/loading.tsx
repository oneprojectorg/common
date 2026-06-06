import { Skeleton } from '@op/ui/Skeleton';

export default function Loading() {
  return (
    <div className="mt-8 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
