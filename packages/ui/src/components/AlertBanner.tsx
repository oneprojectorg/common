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
  warning:
    'border-primary-orange1 text-orange1-600 [background:linear-gradient(rgba(255,255,255,0.92),rgba(255,255,255,0.92)),var(--color-primary-orange1)]',
  alert:
    'border-functional-red text-black [background:linear-gradient(rgba(255,255,255,0.96),rgba(255,255,255,0.96)),var(--color-functional-red)]',
  neutral: 'border-neutral-gray2 bg-neutral-offWhite text-neutral-black',
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
        'flex w-full items-center gap-1 rounded-lg border p-4 shadow-light',
        variantStyles[variant],
        className,
      )}
      contentClassName="flex min-w-0 items-center gap-1"
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
