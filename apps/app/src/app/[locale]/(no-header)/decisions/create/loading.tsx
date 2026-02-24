import { Skeleton } from '@op/ui/Skeleton';

const CreateDecisionLoading = () => {
  return (
    <div className="flex size-full flex-col">
      <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
        <div className="flex items-center gap-2 pl-4 md:pl-8">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </header>
      <div className="size-full grow p-4 sm:p-8">
        <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto rounded-lg border bg-neutral-offWhite p-4 md:gap-8 md:p-8">
          <Skeleton className="h-8 w-64" />
        </div>
      </div>
    </div>
  );
};

export default CreateDecisionLoading;
