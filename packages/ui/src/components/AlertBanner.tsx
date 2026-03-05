import { ReactNode } from 'react';
import { LuInfo } from 'react-icons/lu';

import { cn } from '../lib/utils';

const variantStyles = {
  warning:
    'border-[var(--warning)] text-[hsl(var(--op-yellow-600))] bg-[var(--warning-subtle)]',
  alert:
    'border-[var(--danger)] text-[var(--fg,hsl(var(--op-neutral-950)))] bg-[var(--danger-subtle)]',
  neutral:
    'border-[var(--border,hsl(var(--op-neutral-400)))] text-[var(--fg,hsl(var(--op-neutral-950)))] bg-[var(--muted,hsl(var(--op-neutral-50)))]',
} as const;

export function AlertBanner({
  variant = 'warning',
  icon,
  children,
  className,
}: {
  variant?: 'warning' | 'alert' | 'neutral';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-1 rounded-lg border p-4 shadow-light',
        variantStyles[variant],
        className,
      )}
    >
      <span className="shrink-0 [&>svg]:size-4">
        {icon ?? <LuInfo className="size-4" />}
      </span>
      <span className="truncate text-sm font-normal leading-[1.5]">
        {children}
      </span>
    </div>
  );
}
