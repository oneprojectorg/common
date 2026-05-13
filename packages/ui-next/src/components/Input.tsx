import type { ReactNode } from 'react';
import * as React from 'react';
import { tv, type VariantProps } from 'tailwind-variants';

import { cn } from '@/lib/utils';

import { Input as ShadcnInput } from '@/components/ui/input';

const inputVariants = tv({
  variants: {
    color: {
      primary: '',
      muted: 'text-muted-foreground bg-muted',
      error: 'border-destructive ring-destructive/20',
    },
    size: {
      default: '',
      sm: 'h-7 px-2 text-sm',
    },
  },
  defaultVariants: {
    color: 'primary',
    size: 'default',
  },
});

type InputVariantsProps = VariantProps<typeof inputVariants>;

type InputProps = Omit<
  React.ComponentProps<typeof ShadcnInput>,
  'size' | 'color'
> &
  InputVariantsProps & {
    icon?: ReactNode;
  };

function Input({ className, color, size, icon, ...props }: InputProps) {
  if (icon) {
    return (
      <span className="relative w-full">
        <ShadcnInput
          className={cn(inputVariants({ color, size }), 'pl-8', className)}
          {...props}
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 [&>svg]:size-4">
          {icon}
        </span>
      </span>
    );
  }

  return (
    <ShadcnInput
      className={cn(inputVariants({ color, size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
export type { InputProps, InputVariantsProps };
