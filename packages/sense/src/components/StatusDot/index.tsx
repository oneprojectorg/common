import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export type StatusDotIntent = 'success' | 'danger' | 'warning' | 'neutral';

export type StatusDotSize = 'sm' | 'md';

interface StatusDotProps {
  /** Color of the dot. */
  intent?: StatusDotIntent;
  /** `md` suits a label set larger than body text, such as a group heading. */
  size?: StatusDotSize;
  /** Additional classes applied to the flex container. */
  className?: string;
  /** Inline label to the right of the dot — carries the status's meaning. */
  children: ReactNode;
}

const DOT_COLOR_BY_INTENT: Record<StatusDotIntent, string> = {
  success: 'bg-success',
  danger: 'bg-destructive',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground',
};

const DOT_SIZE: Record<StatusDotSize, string> = {
  sm: 'size-2',
  md: 'size-3',
};

function StatusDot({
  intent = 'neutral',
  size = 'sm',
  className,
  children,
}: StatusDotProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full',
          DOT_SIZE[size],
          DOT_COLOR_BY_INTENT[intent],
        )}
        aria-hidden
      />
      {children}
    </div>
  );
}

export { StatusDot, type StatusDotProps };
