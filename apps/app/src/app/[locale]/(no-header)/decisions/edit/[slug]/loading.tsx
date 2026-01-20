import { Skeleton } from '@op/ui/Skeleton';

const Loading = () => {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="h-14 w-full" />
      <div className="flex flex-1">
        <Skeleton className="h-full w-64" />
        <Skeleton className="h-full flex-1" />
      </div>
    </div>
  );
};

export default Loading;
