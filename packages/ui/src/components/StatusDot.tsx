import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

export type StatusDotIntent = 'success' | 'danger' | 'warning' | 'neutral';

const DOT_COLOR_BY_INTENT: Record<StatusDotIntent, string> = {
  success: 'bg-functional-green',
  danger: 'bg-functional-red',
  warning: 'bg-primary-yellow',
  neutral: 'bg-neutral-gray3',
};

export const StatusDot = ({
  intent = 'neutral',
  className,
  children,
}: {
  intent?: StatusDotIntent;
  className?: string;
  children?: ReactNode;
}) => {
  const dotColor = DOT_COLOR_BY_INTENT[intent];

  if (!children) {
    return (
      <span
        className={cn('size-2 rounded-full', dotColor, className)}
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
