// Compatibility wrapper for @op/ui's LoadingSpinner. Renders shadcn's `Spinner`
// (LuLoaderCircle from react-icons/lu) with the legacy color/size variants.

import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { Spinner } from './ui/spinner';

const spinnerVariants = tv({
  base: 'aspect-square h-full w-auto animate-spin',
  variants: {
    color: {
      gray: 'text-muted-foreground',
      teal: 'text-primary',
    },
    size: {
      md: 'size-6',
    },
  },
  defaultVariants: {
    color: 'teal',
    size: 'md',
  },
});

export interface LoadingSpinnerProps {
  className?: string;
  color?: 'teal' | 'gray';
  size?: 'md';
}

export function LoadingSpinner({
  className,
  color,
  size,
}: LoadingSpinnerProps) {
  return (
    <Spinner className={cn(spinnerVariants({ color, size }), className)} />
  );
}
