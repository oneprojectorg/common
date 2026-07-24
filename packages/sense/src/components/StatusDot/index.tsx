import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export type StatusDotIntent = 'success' | 'danger' | 'warning' | 'neutral';

interface StatusDotProps {
  /** Color of the dot. */
  intent?: StatusDotIntent;
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

function StatusDot({
  intent = 'neutral',
  className,
  children,
}: StatusDotProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn('size-2 rounded-full', DOT_COLOR_BY_INTENT[intent])}
        aria-hidden
      />
      {children}
    </div>
  );
}

export { StatusDot, type StatusDotProps };
