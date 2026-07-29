import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';
import { Spinner } from './spinner';

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg text-base font-strong whitespace-nowrap no-underline transition-all outline-none select-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_10%)] active:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_15%)]',
        outline:
          'border border-input bg-background text-foreground hover:bg-muted focus-visible:border-ring active:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_3%)] aria-expanded:bg-muted aria-invalid:border-destructive dark:border-input dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)] active:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_15%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'text-foreground hover:bg-muted active:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_3%)] aria-expanded:bg-muted dark:hover:bg-muted/50',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive),var(--foreground)_10%)] active:bg-[color-mix(in_oklch,var(--destructive),var(--foreground)_15%)] focus-visible:ring-destructive/40 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-md px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-4",
        lg: 'h-12 gap-1.5 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
        icon: 'size-11',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8 rounded-md in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-12',
      },
    },
    compoundVariants: [
      // Figma: destructive at small sizes is the washed "secondary" look —
      // red-50 fill with destructive text — not the solid fill.
      {
        variant: 'destructive',
        size: ['sm', 'xs', 'icon-sm', 'icon-xs'],
        class:
          'bg-destructive-muted text-destructive hover:bg-red-100 active:bg-red-200 focus-visible:ring-destructive/20',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * Show a centered spinner over the label and block interaction. Keeps the
     * button's fill and width (the label stays laid out but invisible). Works
     * for any variant and when the button is rendered as a link (`render`).
     */
    loading?: boolean;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && 'pointer-events-none',
      )}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible flex items-center gap-1.5">
            {children}
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
