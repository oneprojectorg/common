import type { HTMLAttributes, ReactNode } from 'react';

import { VariantProps, cn, tv } from '../lib/utils';

const variantStyles = tv({
  base: 'bg-neutral-white overflow-hidden rounded border',
  variants: {
    variant: {
      empty: '',
      filled: 'bg-neutral-offWhite',
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
} & SurfaceVariantsProps &
  HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        variantStyles({
          ...props,
        } as SurfaceVariantsProps),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
