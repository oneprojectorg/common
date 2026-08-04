import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import {
  LuArrowRight,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuFlag,
  LuHourglass,
} from 'react-icons/lu';

import { cn } from '../../lib/utils';

const statusBadgeVariants = cva(
  'inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:size-3.5 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        inactive: 'bg-muted text-foreground [&>svg]:text-muted-foreground',
        'in-progress': 'bg-teal-50 text-foreground [&>svg]:text-teal-600',
        warning: 'bg-warning-muted text-foreground [&>svg]:text-warning',
        revision: 'bg-warning-muted text-foreground [&>svg]:text-warning',
        alert: 'bg-destructive-muted text-foreground [&>svg]:text-destructive',
        success: 'bg-success-muted text-foreground [&>svg]:text-success',
        ghost:
          'bg-transparent text-foreground hover:bg-muted [&>svg]:text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'inactive',
    },
  },
);

const VARIANT_ICON: Record<
  NonNullable<VariantProps<typeof statusBadgeVariants>['variant']>,
  IconType
> = {
  inactive: LuCircleDashed,
  'in-progress': LuHourglass,
  warning: LuCircleAlert,
  revision: LuCircleAlert,
  alert: LuFlag,
  success: LuCircleCheck,
  ghost: LuCircleDashed,
};

export interface StatusBadgeProps extends VariantProps<
  typeof statusBadgeVariants
> {
  children: ReactNode;
  /** Show the trailing arrow (the badge navigates / drills in). */
  hasArrow?: boolean;
  /** Override the leading icon; defaults to the variant's icon. */
  icon?: IconType;
  className?: string;
}

/**
 * A small status pill with a variant-colored leading icon — used on proposal
 * and review cards to show state (inactive, in progress, warning, alert,
 * success). Presentational; the caller owns the label and, optionally, a
 * trailing arrow indicating the badge drills into detail.
 */
export function StatusBadge({
  variant = 'inactive',
  children,
  hasArrow = false,
  icon,
  className,
}: StatusBadgeProps) {
  const LeadingIcon = icon ?? VARIANT_ICON[variant ?? 'inactive'];
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      <LeadingIcon aria-hidden />
      {children}
      {hasArrow ? (
        <LuArrowRight aria-hidden className="rtl:rotate-180" />
      ) : null}
    </span>
  );
}
