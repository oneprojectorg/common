import { cn } from '../../lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-lg bg-gray-200', className)}
      {...props}
    />
  );
}

export { Skeleton };
