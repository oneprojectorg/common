'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Button } from './ui/button';

type LegacySize = 'small' | 'medium' | 'large';
type LegacyVariant = 'ghost' | 'solid' | 'outline';

const sizeMap = {
  small: 'icon-sm',
  medium: 'icon',
  large: 'icon-lg',
} as const;

const variantMap = {
  ghost: 'ghost',
  solid: 'secondary',
  outline: 'outline',
} as const;

export interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'variant' | 'size'
> {
  children: ReactNode;
  size?: LegacySize;
  variant?: LegacyVariant;
  className?: string;
}

export const IconButton = ({
  size = 'medium',
  variant = 'ghost',
  ...props
}: IconButtonProps) => {
  return (
    <Button {...props} size={sizeMap[size]} variant={variantMap[variant]} />
  );
};
