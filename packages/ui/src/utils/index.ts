import { composeRenderProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

export const focusRing = tv({
  base: 'outline-auto -outline-offset-8 outline-transparent focus-within:outline-offWhite focus-visible:outline-offWhite',
  variants: {
    isFocused: {
      true: 'outline-lightGray',
    },
    isFocusVisible: {
      true: 'outline-lightGray',
    },
  },
});

export function composeTailwindRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tw: string,
): string | ((v: T) => string) {
  return composeRenderProps(className, (cls) => cn(tw, cls));
}
