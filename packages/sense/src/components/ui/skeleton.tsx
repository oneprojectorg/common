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

// Multi-line text placeholder. Renders `lines`
// short bars; the last one is narrower to mimic a ragged final line of text.
function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.ComponentProps<'div'> & { lines?: number }) {
  return (
    <div
      data-slot="skeleton-text"
      className={cn('flex w-full flex-col gap-2', className)}
      {...props}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            'h-4',
            lines > 1 && index === lines - 1 ? 'w-2/3' : 'w-full',
          )}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText };
