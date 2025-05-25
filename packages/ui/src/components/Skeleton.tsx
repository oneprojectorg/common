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
  animated,
  ...props
}: Omit<SkeletonProps, 'lines'>) => {
  return (
    <div
      className={cn(
        'min-h-4 rounded-sm bg-neutral-gray1',
        'animate-pulse',
        animated && 'animate-[sweep]',
        className,
      )}
      {...props}
    />
  );
};

export const SkeletonLine: React.FC<SkeletonProps> = memo(
  ({ className, lines = 10, randomWidth = true, animated = true }) => {
    const width = useMemo(() => Math.random() * 50 + 40, []);

    return (
      <div
        className={cn('flex animate-pulse flex-col gap-[0.75em]', className)}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={`${index + 1}`}
            className={cn(
              'h-[1em] rounded-[0.25em] bg-gradient-to-br from-neutral-300 to-neutral-200',
              animated && 'animate-pulse',
            )}
            style={{
              backgroundSize: '200% 200%',
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
