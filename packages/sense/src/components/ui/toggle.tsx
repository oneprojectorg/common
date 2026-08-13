'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const toggleVariants = cva(
  "group/toggle inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg text-base font-strong text-foreground whitespace-nowrap transition-all outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-accent aria-pressed:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-background hover:bg-muted aria-pressed:border-accent-foreground',
        // Figma `Toggle` → `Variant=Ghost`: muted label, no fill at rest, and
        // pressed reads as primary-colored text with NO background (unlike
        // `default`, which fills with accent). For inline, low-chrome toggles
        // like the proposal engagement row.
        ghost:
          'bg-transparent text-muted-foreground hover:text-foreground aria-pressed:bg-transparent aria-pressed:text-primary',
      },
      size: {
        default:
          'h-11 min-w-11 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
        sm: "h-8 min-w-8 rounded-md px-3 text-sm has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-4",
        lg: 'h-12 min-w-12 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
        // Square icon-only toggles (no horizontal padding), sized to match the
        // Button icon variants.
        icon: 'size-11 p-0',
        'icon-sm': "size-8 rounded-md p-0 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    // Ghost sits tighter than the bordered variants at every size (Figma: 12px
    // vs 16px at default, 8px vs 12px at sm) — it has no border to sit inside.
    compoundVariants: [
      { variant: 'ghost', size: 'default', className: 'px-3' },
      { variant: 'ghost', size: 'sm', className: 'px-2' },
      { variant: 'ghost', size: 'lg', className: 'px-3' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
