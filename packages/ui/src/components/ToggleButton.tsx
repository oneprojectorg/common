'use client';

import {
  ToggleButton as TakiToggleButton,
  type ToggleButtonProps as TakiToggleButtonProps,
} from './ui/toggle-button';

type LegacySize = 'default' | 'small';

export interface ToggleButtonProps extends Omit<TakiToggleButtonProps, 'size'> {
  size?: LegacySize;
}

export const ToggleButton = ({
  size = 'default',
  ...props
}: ToggleButtonProps) => {
  return (
    <TakiToggleButton {...props} size={size === 'small' ? 'sm' : 'default'} />
  );
};

export { toggleButtonVariants } from './ui/toggle-button';
