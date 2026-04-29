'use client';

import {
  ToggleButton as AriaToggleButton,
  ToggleButtonProps as AriaToggleButtonProps,
  composeRenderProps,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../../lib/utils';

export interface ToggleButtonProps extends AriaToggleButtonProps {
  /** @default 'default' */
  variant?: 'default' | 'outline';
  /** @default 'default' */
  size?: 'default' | 'sm' | 'lg';
}

export const toggleButtonVariants = tv({
  extend: focusRing,
  base: "inline-flex cursor-default items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  variants: {
    variant: {
      default:
        'bg-transparent hover:bg-muted hover:text-muted-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground',
      outline:
        'border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground',
    },
    size: {
      default: 'h-9 min-w-9 px-2',
      sm: 'h-8 min-w-8 px-1.5',
      lg: 'h-10 min-w-10 px-2.5',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-50',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export function ToggleButton(props: ToggleButtonProps) {
  return (
    <AriaToggleButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        toggleButtonVariants({
          ...renderProps,
          variant: props.variant,
          size: props.size,
          className,
        }),
      )}
    />
  );
}
