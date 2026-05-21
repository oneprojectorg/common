// Compat wrapper for @op/ui's ToggleButton. Maps legacy RAC API
// (isSelected/onChange/size) onto shadcn Switch.

'use client';

import * as React from 'react';

import { Switch } from './ui/switch';

type LegacySize = 'default' | 'small';

export interface ToggleButtonProps
  extends Omit<
    React.ComponentProps<typeof Switch>,
    'size' | 'checked' | 'onCheckedChange' | 'defaultChecked'
  > {
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  size?: LegacySize;
  isDisabled?: boolean;
}

const sizeMap: Record<LegacySize, 'sm' | 'default'> = {
  small: 'sm',
  default: 'default',
};

export function ToggleButton({
  isSelected,
  defaultSelected,
  onChange,
  size = 'default',
  isDisabled,
  disabled,
  ...rest
}: ToggleButtonProps) {
  return (
    <Switch
      checked={isSelected}
      defaultChecked={defaultSelected}
      onCheckedChange={onChange}
      size={sizeMap[size]}
      disabled={disabled ?? isDisabled}
      {...rest}
    />
  );
}
