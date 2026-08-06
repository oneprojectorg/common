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

// Figma `StatusBadge` component set (cjLIVfBJVLadAaigW1hjyG node 31776:8610):
// 36px tall, 6px radius, 8px inset, 4px gap, 14px/450 label, a 16px leading icon
// tinted per variant, and an optional 12px trailing arrow. The tint targets the
// icon's `data-slot`, not `svg:first-child` — with `icon={false}` the arrow would
// otherwise become the first child and inherit the leading icon's colour. `Inactive` fills with
// gray-100 (`secondary`) and its icon stays foreground, not muted.
//
// The sheet also shows hover (base fill + white at 20%) and focus states. This
// component renders a plain `span` — it is presentational and never focusable or
// clickable on its own — so those states are unreachable and deliberately not
// implemented; a caller that makes a badge interactive owns them.
const statusBadgeVariants = cva(
  'inline-flex h-9 w-fit shrink-0 items-center gap-1 rounded-md p-2 text-sm font-strong whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        inactive: 'bg-secondary text-foreground',
        'in-progress':
          'bg-teal-50 text-foreground [&>[data-slot=status-badge-icon]]:text-teal-600',
        warning:
          'bg-warning-muted text-foreground [&>[data-slot=status-badge-icon]]:text-warning',
        revision:
          'bg-warning-muted text-foreground [&>[data-slot=status-badge-icon]]:text-warning',
        alert:
          'bg-destructive-muted text-foreground [&>[data-slot=status-badge-icon]]:text-destructive',
        success:
          'bg-success-muted text-foreground [&>[data-slot=status-badge-icon]]:text-success',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
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
  /**
   * Override the leading icon; defaults to the variant's icon. `false` drops it,
   * as the Figma set's icon slot can be turned off — `p-2` then reads as even
   * padding around a bare label.
   */
  icon?: IconType | false;
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
  const LeadingIcon =
    icon === false ? null : (icon ?? VARIANT_ICON[variant ?? 'inactive']);

  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      {/* Leading icon is 16px, the trailing arrow 12px — sized individually
          rather than by one `[&>svg]` rule. */}
      {LeadingIcon ? (
        <LeadingIcon
          aria-hidden
          data-slot="status-badge-icon"
          className="size-4"
        />
      ) : null}
      {children}
      {hasArrow ? (
        <LuArrowRight aria-hidden className="size-3 rtl:rotate-180" />
      ) : null}
    </span>
  );
}
