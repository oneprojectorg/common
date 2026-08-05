import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

// Figma `Badge` component set (cjLIVfBJVLadAaigW1hjyG node 26:169). Geometry:
// 20px tall, 4px radius, 2/8 padding, 4 gap, 12px/450 text, 12px icons, and a
// 1px stroke that is transparent on the filled variants (Figma has it at
// opacity 0 — it only reserves the box).
//
// Hover in the spec is the base fill PLUS a 10% overlay whose color varies by
// variant, so it darkens/saturates rather than fading toward white. That is an
// `after` layer at `-z-10` (above the background, below the text — `isolate`
// keeps the stacking context local), which is exactly how Figma stacks it.
// Hover applies only when the badge is actually interactive, i.e. rendered as an
// `a` or `button`; inert status badges shouldn't light up under the cursor.
const badgeVariants = cva(
  'group/badge relative isolate inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 py-0.5 text-xs font-strong whitespace-nowrap transition-all after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground [&:is(a,button)]:hover:after:bg-foreground/10',
        secondary:
          'bg-secondary text-secondary-foreground [&:is(a,button)]:hover:after:bg-foreground/10',
        destructive:
          'bg-destructive-muted text-foreground focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [&:is(a,button)]:hover:after:bg-destructive/10',
        warning:
          'bg-warning-muted text-foreground [&:is(a,button)]:hover:after:bg-warning/10',
        accent:
          'bg-accent text-accent-foreground [&:is(a,button)]:hover:after:bg-primary/10',
        // Outline and ghost don't overlay — they swap their fill to `muted`.
        outline:
          'border-border bg-background text-foreground [&:is(a,button)]:hover:bg-muted',
        ghost: 'text-foreground [&:is(a,button)]:hover:bg-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}

/**
 * A count badge — the `Badge/Number` Figma component. A circular/pill `Badge`
 * sized for 1+ digit counts (`min-w-5` grows into a pill for two digits).
 * Defaults to the primary variant; pass `variant` for other colors.
 */
function BadgeNumber({
  className,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <Badge className={cn('min-w-5 rounded-full px-1', className)} {...props} />
  );
}

export { Badge, BadgeNumber, badgeVariants };
