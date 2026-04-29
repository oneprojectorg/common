'use client';

import {
  composeRenderProps,
  InputProps,
  Input as RACInput,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

export const inputStyles = tv({
  base: [
    'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground md:text-sm dark:bg-input/30 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
  ],
  variants: {
    isDisabled: {
      true: 'pointer-events-none cursor-not-allowed opacity-50',
    },
    isFocusVisible: {
      true: 'border-ring ring-[3px] ring-ring/50',
    },
    isFocused: {
      true: 'z-10 border-ring ring-[3px] ring-ring/50',
    },
    isInvalid: {
      true: 'border-destructive ring-destructive/20 dark:ring-destructive/40',
    },
  },
});

function Input({ className, type, ...props }: InputProps) {
  return (
    <RACInput
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (className, renderProps) =>
        inputStyles({ ...renderProps, className }),
      )}
      {...props}
    />
  );
}

export { Input };
