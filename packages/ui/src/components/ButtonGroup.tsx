import { twMerge } from 'tailwind-merge';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

const buttonGroupStyles = tv({
  base: "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 [&>*]:shadow-none [&>[aria-pressed=false]]:bg-neutral-offWhite [&>[aria-pressed=false]]:text-neutral-charcoal [&>[aria-pressed=false]_svg]:text-neutral-gray4 [&>[aria-pressed=false]:hover]:bg-neutral-offWhite [&>[aria-pressed=true]]:bg-primary-tealWhite [&>[aria-pressed=true]]:text-primary-teal [&>[aria-pressed=true]:hover]:bg-primary-tealWhite has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-e-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  variants: {
    orientation: {
      horizontal:
        '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
      vertical:
        'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

export function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof buttonGroupStyles>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={buttonGroupStyles({ orientation, className })}
      {...props}
    />
  );
}

export function ButtonGroupText({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={twMerge(
        "flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs *:data-[slot=icon]:pointer-events-none [&_[data-slot=icon]:not([class*='size-'])]:size-5 sm:[&_[data-slot=icon]:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}
