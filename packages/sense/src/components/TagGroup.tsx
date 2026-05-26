// Compat for @op/ui's TagGroup/Tag. Drops RAC selection/removal model; consumers
// that need close/remove behavior render their own button inside the Tag.

'use client';

import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

export interface TagGroupProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export const TagGroup = ({
  children,
  className,
  'aria-label': ariaLabel,
}: TagGroupProps) => {
  return (
    <div
      data-slot="tag-group"
      aria-label={ariaLabel}
      role="list"
      className={cn('flex flex-wrap gap-1', className)}
    >
      {children}
    </div>
  );
};

export interface TagProps {
  children: ReactNode;
  className?: string;
  id?: string;
  textValue?: string;
}

export const Tag = ({ children, className }: TagProps) => {
  return (
    <Badge variant="secondary" role="listitem" className={className}>
      {children}
    </Badge>
  );
};
