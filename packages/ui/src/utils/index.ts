import { composeRenderProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

export const focusRing = tv({
  base: 'outline outline-2 -outline-offset-2 outline-transparent focus-within:outline-neutral-500 focus:outline-neutral-500 focus-visible:outline-neutral-400',
  variants: {
    isFocused: {
      true: 'outline-neutral-500',
    },
    isFocusVisible: {
      true: 'outline-neutral-400',
    },
  },
});

export function composeTailwindRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tw: string,
): string | ((v: T) => string) {
  return composeRenderProps(className, cls => cn(tw, cls));
}
