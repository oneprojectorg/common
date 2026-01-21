import { Skeleton } from '@op/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-offWhite">
      <div className="border-b bg-white p-2 px-6 md:py-3">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}
