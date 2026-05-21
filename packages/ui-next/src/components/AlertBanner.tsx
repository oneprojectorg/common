// Compat wrapper for @op/ui's AlertBanner. Composition over vanilla shadcn
// Alert primitive. `intent` selects shadcn variant + icon color; `danger` maps
// to shadcn's destructive variant for true red text styling.

import type { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInfo } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Alert } from './ui/alert';

type Intent = 'default' | 'info' | 'warning' | 'danger' | 'success';

const ICON_BY_INTENT: Record<
  Intent,
  React.ComponentType<{ className?: string }> | null
> = {
  default: null,
  info: LuInfo,
  warning: LuCircleAlert,
  danger: LuCircleAlert,
  success: LuCircleCheck,
};

// Tints applied to the alert root for non-destructive intents. Destructive is
// handled by shadcn Alert's built-in variant.
const TINT_BY_INTENT: Record<Intent, string> = {
  default: '',
  info: 'text-blue-700 [&_svg]:text-blue-600',
  warning: 'text-amber-700 [&_svg]:text-amber-600',
  danger: '',
  success: 'text-emerald-700 [&_svg]:text-emerald-600',
};

export interface AlertBannerProps
  extends React.HtmlHTMLAttributes<HTMLDivElement> {
  intent?: Intent;
  /** `default` = bordered card; `banner` = no shadow inline notice. */
  variant?: 'default' | 'banner';
  /** Show the intent icon. Defaults to true. */
  indicator?: boolean;
  /** Override the auto-selected intent icon. */
  icon?: ReactNode;
  contentClassName?: string;
  /** Span parent's full width: removes side borders and rounded corners. */
  fullWidth?: boolean;
}

export function AlertBanner({
  indicator = true,
  intent = 'default',
  variant = 'default',
  icon,
  className,
  contentClassName,
  fullWidth = false,
  children,
  ...props
}: AlertBannerProps) {
  const Icon = ICON_BY_INTENT[intent];
  const showIcon = indicator && (icon !== undefined || Icon !== null);
  const shadcnVariant = intent === 'danger' ? 'destructive' : 'default';

  return (
    <Alert
      variant={shadcnVariant}
      className={cn(
        TINT_BY_INTENT[intent],
        variant === 'banner' && 'shadow-none',
        fullWidth && 'rounded-none border-x-0',
        className,
      )}
      {...props}
    >
      {showIcon ? (icon ?? (Icon ? <Icon /> : null)) : null}
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </Alert>
  );
}
