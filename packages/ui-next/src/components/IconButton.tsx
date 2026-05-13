// Compatibility wrapper for @op/ui's IconButton. Maps legacy size/variant onto
// shadcn icon-* sizes and ghost/secondary/outline variants.

import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button as ShadcnButton } from '@/components/ui/button';

type LegacySize = 'small' | 'medium' | 'large';
type LegacyVariant = 'ghost' | 'solid' | 'outline';

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'color' | 'size'
> {
  size?: LegacySize;
  variant?: LegacyVariant;
  isDisabled?: boolean;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
}

const sizeMap: Record<LegacySize, 'icon-xs' | 'icon' | 'icon-lg'> = {
  small: 'icon-xs',
  medium: 'icon',
  large: 'icon-lg',
};

const variantMap: Record<LegacyVariant, 'ghost' | 'secondary' | 'outline'> = {
  ghost: 'ghost',
  solid: 'secondary',
  outline: 'outline',
};

export function IconButton(props: IconButtonProps) {
  const {
    size = 'medium',
    variant = 'ghost',
    isDisabled,
    disabled,
    onPress,
    onClick,
    className,
    children,
    ...rest
  } = props;

  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      disabled={disabled || isDisabled}
      onClick={onClick ?? onPress}
      className={cn('rounded-full', className)}
      {...rest}
    >
      {children}
    </ShadcnButton>
  );
}
