import { cn } from '../../lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-lg bg-gray-100 dark:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
