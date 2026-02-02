'use client';

import { Button as RACButton } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

const iconButtonStyle = tv({
  base: 'flex cursor-pointer items-center justify-center outline-hidden duration-200 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-teal-600',
  variants: {
    size: {
      small: 'h-6 w-6 rounded-full',
      medium: 'h-8 w-8 rounded-lg',
      large: 'h-10 w-10 rounded-lg',
    },
    variant: {
      ghost: 'pressed:bg-neutral-gray2 bg-white/80 hover:bg-neutral-gray1',
      solid: 'pressed:bg-neutral-gray3 bg-neutral-gray1 hover:bg-neutral-gray2',
      outline:
        'pressed:bg-neutral-gray2 border bg-transparent hover:bg-neutral-gray1',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-30',
      false: '',
    },
  },
  defaultVariants: {
    size: 'medium',
    variant: 'ghost',
  },
});

type IconButtonVariants = VariantProps<typeof iconButtonStyle>;

export interface IconButtonProps
  extends Omit<React.ComponentProps<typeof RACButton>, 'children'>,
    IconButtonVariants {
  children: React.ReactNode;
  className?: string;
}

export const IconButton = (props: IconButtonProps) => {
  const { children, className, ...rest } = props;

  return (
    <RACButton {...rest} className={iconButtonStyle({ ...props, className })}>
      {children}
    </RACButton>
  );
};
