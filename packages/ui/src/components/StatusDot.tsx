import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

export type StatusDotIntent = 'success' | 'danger' | 'warning' | 'neutral';

const DOT_COLOR_BY_INTENT: Record<StatusDotIntent, string> = {
  success: 'bg-functional-green',
  danger: 'bg-functional-red',
  warning: 'bg-primary-yellow',
  neutral: 'bg-neutral-gray3',
};

export interface StatusDotProps {
  /** Color of the dot. */
  intent?: StatusDotIntent;
  /** Additional classes applied to the flex container. */
  className?: string;
  /** Inline label rendered to the right of the dot. Carries the accessible meaning of the status. */
  children: ReactNode;
}

export const StatusDot = ({
  intent = 'neutral',
  className,
  children,
}: StatusDotProps) => {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn('size-2 rounded-full', DOT_COLOR_BY_INTENT[intent])}
        aria-hidden
      />
      {children}
    </div>
  );
};
