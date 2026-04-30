'use client';

import type { ComponentProps } from 'react';

import { Badge } from './ui/badge';

export interface ChipProps extends Omit<
  ComponentProps<typeof Badge>,
  'variant'
> {
  variant?: ComponentProps<typeof Badge>['variant'];
}

export const Chip = ({ variant = 'secondary', ...props }: ChipProps) => {
  return <Badge {...props} variant={variant} />;
};

export { Badge };
