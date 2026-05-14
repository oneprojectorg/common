import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

export type StatusDotIntent = 'success' | 'danger' | 'warning' | 'neutral';

const DOT_COLOR_BY_INTENT: Record<StatusDotIntent, string> = {
  success: 'bg-emerald-500',
  danger: 'bg-destructive',
  warning: 'bg-amber-500',
  neutral: 'bg-muted-foreground',
};

export interface StatusDotProps {
  intent?: StatusDotIntent;
  className?: string;
  children: ReactNode;
}

export function StatusDot({
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
