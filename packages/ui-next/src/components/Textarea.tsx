import * as React from 'react';
import { tv, type VariantProps } from 'tailwind-variants';

import { cn } from '@/lib/utils';

import { Textarea as ShadcnTextarea } from '@/components/ui/textarea';

const textareaVariants = tv({
  variants: {
    variant: {
      default: '',
      borderless: 'border-none p-0 shadow-none focus-visible:ring-0',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type TextareaVariantsProps = VariantProps<typeof textareaVariants>;

type TextareaProps = React.ComponentProps<typeof ShadcnTextarea> &
  TextareaVariantsProps;

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <ShadcnTextarea
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
export type { TextareaProps, TextareaVariantsProps };
