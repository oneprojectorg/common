import { ReactNode } from 'react';
import { LuInfo } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Note } from './ui/note';

const variantToIntent = {
  warning: 'warning',
  alert: 'danger',
  neutral: 'default',
} as const;

const variantStyles = {
  warning: 'text-[hsl(var(--op-yellow-600))]',
  alert: 'text-[var(--fg,hsl(var(--op-neutral-950)))]',
  neutral:
    'text-[var(--fg,hsl(var(--op-neutral-950)))] border-[var(--border,hsl(var(--op-neutral-400)))] bg-[var(--muted,hsl(var(--op-neutral-50)))]',
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
    <Note
      intent={variantToIntent[variant]}
      indicator={false}
      className={cn(
        'flex items-center gap-1 rounded-lg p-4 shadow-light',
        variantStyles[variant],
        className,
      )}
    >
      <span className="shrink-0 [&>svg]:size-4">
        {icon ?? <LuInfo className="size-4" />}
      </span>
      <span className="truncate text-sm leading-[1.5] font-normal">
        {children}
      </span>
    </Note>
  );
}
