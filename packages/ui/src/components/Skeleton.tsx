import { memo, useMemo } from 'react';

import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  lines?: number;
  randomWidth?: boolean;
  animated?: boolean;
}

export const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
};

export const SkeletonLine: React.FC<SkeletonProps> = memo(
  ({ className, lines = 10, randomWidth = true, animated = true }) => {
    const animationDuration = useMemo(() => Math.random() * 2 + 0.8, []);
    const width = useMemo(() => Math.random() * 50 + 40, []);

    return (
      <div
        className={cn(
          'flex flex-col gap-[0.75em] animate-in fade-in duration-animate-300',
          className,
        )}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={`${index + 1}`}
            className={cn(
              'h-[1em] rounded-[0.25em] bg-gradient-to-br from-neutral-300 to-neutral-200',
              animated && 'animate-[sweep]',
            )}
            style={{
              backgroundSize: '200% 200%',
              animationDuration: `${animationDuration}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              width: randomWidth
                ? index === lines - 1
                  ? `${width}%`
                  : '100%'
                : undefined,
            }}
          />
        ))}
      </div>
    );
  },
);
