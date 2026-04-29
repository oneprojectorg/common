'use client';

import {
  Button as AriaButton,
  composeRenderProps,
  ButtonProps as RACButtonProps,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../../lib/utils';

export interface ButtonProps extends RACButtonProps {
  /** @default 'default' */
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  /** @default 'default' */
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
}

export const buttonVariants = tv({
  extend: focusRing,
  base: 'inline-flex shrink-0 cursor-default items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive:
        'bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60',
      outline:
        'border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost:
        'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
      link: 'text-primary underline-offset-4 hover:underline',
    },
    size: {
      default: 'h-9 px-4 py-2 has-[>svg]:px-3',
      sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
      lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
      icon: 'size-9',
      'icon-xs': 'size-6',
      'icon-sm': 'size-8',
      'icon-lg': 'size-10',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-50',
    },
    isPending: {
      true: 'text-transparent',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export function Button(props: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        buttonVariants({
          ...renderProps,
          variant: props.variant,
          size: props.size,
          className,
        }),
      )}
    >
      {composeRenderProps(props.children, (children) => (
        <>{children}</>
      ))}
    </AriaButton>
  );
}
