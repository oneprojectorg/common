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
  /** Additional classes applied to the root element (the dot itself when standalone, the flex container when a label is present). */
  className?: string;
  /** Optional inline label rendered to the right of the dot. */
  children?: ReactNode;
}

export const StatusDot = ({
  intent = 'neutral',
  className,
  children,
}: StatusDotProps) => {
  const dotColor = DOT_COLOR_BY_INTENT[intent];

  if (!children) {
    return (
      <span
        className={cn('inline-block size-2 rounded-full', dotColor, className)}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('size-2 rounded-full', dotColor)} aria-hidden />
      {children}
    </div>
  );
};
