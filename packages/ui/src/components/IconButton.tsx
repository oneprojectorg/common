'use client';

import type { ComponentProps } from 'react';

import { Button } from './ui/button';

/** Canonical Taki/shadcn icon sizes — preferred for new code. */
export type IconSize = 'icon-sm' | 'icon' | 'icon-lg';

/**
 * @deprecated Use `IconSize` ('icon-sm' | 'icon' | 'icon-lg').
 * Mapping during migration:
 *   'sm' / 'small'   -> 'icon-sm'
 *   'medium'         -> 'icon'
 *   'lg' / 'large'   -> 'icon-lg'
 */
export type LegacyIconSize = 'sm' | 'small' | 'lg' | 'large' | 'medium';

type AliasSize = IconSize | LegacyIconSize;

export interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'size'
> {
  /**
   * Defaults to "icon" (36px square). Prefer the IconSize values
   * directly. Legacy `small`/`medium`/`large` and Taki `sm`/`lg` are
   * accepted as aliases during the migration but slated for removal.
   */
  size?: AliasSize;
}

const sizeMap: Record<AliasSize, ComponentProps<typeof Button>['size']> = {
  'icon-sm': 'icon-sm',
  icon: 'icon',
  'icon-lg': 'icon-lg',
  sm: 'icon-sm',
  small: 'icon-sm',
  medium: 'icon',
  lg: 'icon-lg',
  large: 'icon-lg',
};

export const IconButton = ({ size = 'icon', ...props }: IconButtonProps) => {
  return <Button {...props} size={sizeMap[size]} />;
};
