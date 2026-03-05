import { ReactNode } from 'react';
import { LuInfo } from 'react-icons/lu';

import { cn } from '../lib/utils';

const variantStyles = {
  warning: 'border-yellow-500 text-yellow-600 bg-[hsl(var(--op-yellow-500)/0.08)]',
  alert: 'border-red-500 text-black bg-[hsl(var(--op-red-500)/0.04)]',
  neutral: 'border-lightGray text-black bg-whiteish',
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
        'flex w-full items-center gap-1 rounded-md border p-4 shadow-light',
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
