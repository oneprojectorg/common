export function ReviewSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-4">
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="mx-auto hidden min-h-0 w-full max-w-6xl flex-1 sm:flex">
        <div className="flex-1 border-e p-12">
          <div className="space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex-1 px-12 pt-12">
          <div className="space-y-6">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
