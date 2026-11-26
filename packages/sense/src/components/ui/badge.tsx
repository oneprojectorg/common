import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

type BadgeVariants = VariantProps<typeof badgeVariants>;

// Non-nullable: cva emits no classes for an explicit `null`, which would drop
// the height and text size.
type BadgeProps = useRender.ComponentProps<'span'> & {
  variant?: NonNullable<BadgeVariants['variant']>;
  size?: BadgeSize;
};

type BadgeSize = NonNullable<BadgeVariants['size']>;

// Figma `Badge` component set (cjLIVfBJVLadAaigW1hjyG node 26:169): 20px tall,
// 4px radius, 2/8 padding, 12px/450 text, and a stroke that is transparent on
// the filled variants (it only reserves the box).
//
// Hover is the base fill plus a 10% overlay, so it darkens rather than fades —
// an `after` layer under the text, and only when the badge is a link or button.
//
// Ours, not shadcn's: `size`. `default` is the Figma 20px badge; `md` and `lg`
// grow the box with the text so it never clips under `overflow-hidden`.
const badgeVariants = cva(
  'group/badge relative isolate inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 py-0.5 font-sans font-strong tracking-normal whitespace-nowrap transition-all motion-reduce:transition-none after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
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
        // Ours, not shadcn's: the Figma set's green-tinted badge, the
        // success-muted fill with the same dark text as `warning`.
        success:
          'bg-success-muted text-foreground [&:is(a,button)]:hover:after:bg-success/10',
        accent:
          'bg-accent text-accent-foreground [&:is(a,button)]:hover:after:bg-primary/10',
        // Outline and ghost don't overlay — they swap their fill to `muted`.
        outline:
          'border-border bg-background text-foreground [&:is(a,button)]:hover:bg-muted',
        ghost: 'text-foreground [&:is(a,button)]:hover:bg-muted',
      },
      size: {
        default: 'h-5 text-xs',
        md: 'h-6 text-sm [&>svg]:size-3.5!',
        lg: 'h-7 px-2.5 text-base has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&>svg]:size-4!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

// Keeps a count badge circular at each size: min width equals the height.
const badgeNumberMinWidth: Record<BadgeSize, string> = {
  default: 'min-w-5',
  md: 'min-w-6',
  lg: 'min-w-7',
};

function Badge({
  className,
  variant = 'default',
  size,
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant, size }), className),
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
 * sized for 1+ digit counts (the min width grows into a pill for two digits).
 * Defaults to the primary variant; pass `variant` for other colors and `size`
 * to match a larger `Badge`.
 */
function BadgeNumber({ className, size = 'default', ...props }: BadgeProps) {
  return (
    <Badge
      size={size}
      className={cn(badgeNumberMinWidth[size], 'rounded-full px-1', className)}
      {...props}
    />
  );
}

export { Badge, BadgeNumber, badgeVariants };
export type { BadgeSize };
