'use client';

import type { ComponentProps } from 'react';

import { Button } from './ui/button';

type AliasSize =
  | 'sm'
  | 'small'
  | 'lg'
  | 'large'
  | 'medium'
  | 'icon-sm'
  | 'icon'
  | 'icon-lg';

export interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'size'
> {
  /** Defaults to "icon" (36px square). Legacy `small`/`medium`/`large`
   * and Taki `sm`/`lg` map to `icon-sm`/`icon`/`icon-lg`. */
  size?: AliasSize;
}

const sizeMap: Record<AliasSize, ComponentProps<typeof Button>['size']> = {
  sm: 'icon-sm',
  small: 'icon-sm',
  lg: 'icon-lg',
  large: 'icon-lg',
  medium: 'icon',
  'icon-sm': 'icon-sm',
  icon: 'icon',
  'icon-lg': 'icon-lg',
};

export const IconButton = ({ size = 'icon', ...props }: IconButtonProps) => {
  return <Button {...props} size={sizeMap[size]} />;
};
