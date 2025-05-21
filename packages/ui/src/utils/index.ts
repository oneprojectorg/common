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

export const GRADIENTS = [
  'bg-gradient',
  'bg-tealGreen',
  'bg-redTeal',
  'bg-blueGreen',
  'bg-orangePurple',
];

const getNumberFromHashedString = (name: string): number => {
  let hash = 0;
  if (name.length === 0) return hash;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash as number;
};

export const getGradientForString = (name: string) => {
  const hash = getNumberFromHashedString(name);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};
