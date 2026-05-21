// Compat wrapper for @op/ui's Link (was RAC Link). Drops to plain anchor with
// variant classes. RAC-specific props (e.g., onPress) accepted and mapped.

import type { AnchorHTMLAttributes, MouseEventHandler } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';

import { cn } from '../lib/utils';

const styles = tv({
  base: 'rounded transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:no-underline',
  variants: {
    variant: {
      primary: 'text-primary no-underline hover:underline',
      secondary:
        'text-muted-foreground decoration-muted-foreground/70 hover:decoration-muted-foreground underline',
      neutral: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

type LinkVariants = VariantProps<typeof styles>;

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'color'>, LinkVariants {
  isDisabled?: boolean;
  onPress?: MouseEventHandler<HTMLAnchorElement>;
}

export function Link({
  variant,
  className,
  isDisabled,
  onPress,
  onClick,
  ...props
}: LinkProps) {
  return (
    <a
      {...props}
      onClick={onClick ?? onPress}
      aria-disabled={isDisabled || undefined}
      className={cn(styles({ variant }), className)}
    />
  );
}
