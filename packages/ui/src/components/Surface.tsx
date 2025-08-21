import type { ReactNode } from 'react';

import { VariantProps, cn, tv } from '../lib/utils';

const variantStyles = tv({
  base: 'bg-neutral-white overflow-hidden rounded border border-neutral-gray1',
  variants: {
    variant: {
      empty: '',
      filled: 'border-neutral-gray1 bg-neutral-offWhite',
    },
  },
  defaultVariants: {
    variant: 'empty',
  },
});

export type SurfaceVariantsProps = VariantProps<typeof variantStyles>;

export const Surface = ({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & SurfaceVariantsProps) => {
  return (
    <div
      className={cn(
        variantStyles({
          ...props,
        } as SurfaceVariantsProps),
        className,
      )}
    >
      {children}
    </div>
  );
};
