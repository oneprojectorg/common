import { memo, useMemo } from 'react';

import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  lines?: number;
  randomWidth?: boolean;
  children?: React.ReactNode;
}

export const Skeleton = ({
  className,
  children,
  ...props
}: Omit<SkeletonProps, 'lines'>) => {
  return (
    <div
      className={cn(
        'min-h-4 rounded-sm bg-neutral-gray1',
        'animate-pulse',
        className,
      )}
      {...props}
    >
      {children ? <span className="opacity-0">{children}</span> : null}
    </div>
  );
};

export const SkeletonLine: React.FC<SkeletonProps> = memo(
  ({ className, lines = 10, randomWidth = true, children }) => {
    const width = useMemo(() => Math.random() * 50 + 40, []);

    return (
      <div
        className={cn('flex animate-pulse flex-col gap-[0.75em]', className)}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={`${index + 1}`}
            className="h-[1em] animate-pulse rounded-[0.25em] bg-gradient-to-br from-neutral-300 to-neutral-200"
            style={{
              backgroundSize: '200% 200%',
              width: randomWidth
                ? index === lines - 1
                  ? `${width}%`
                  : '100%'
                : undefined,
            }}
          >
            {children ? <span className="opacity-0">{children}</span> : null}
          </div>
        ))}
      </div>
    );
  },
);
