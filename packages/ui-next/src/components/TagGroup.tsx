// Compat for @op/ui's TagGroup/Tag. Drops RAC selection/removal model; consumers
// that need close/remove behavior render their own button inside the Tag.

'use client';

import * as React from 'react';
import type { ReactNode } from 'react';

import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

export interface TagGroupProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  /** Legacy RAC: called when a tag is removed. Accepted but ignored — tags handle their own remove buttons now. */
  onRemove?: (keys: Set<React.Key>) => void;
}

export const TagGroup = ({
  children,
  className,
  'aria-label': ariaLabel,
  onRemove: _onRemove,
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
