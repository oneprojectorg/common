// Compat wrapper for @op/ui's ProfileItem. Composes vanilla shadcn Item
// primitives.

import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from './ui/item';

export interface ProfileItemProps {
  avatar: ReactNode;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
  size?: 'default' | 'small';
}

export const ProfileItem = ({
  avatar,
  title,
  description,
  className,
  children,
  size = 'default',
}: ProfileItemProps) => {
  return (
    <Item
      variant="default"
      size={size === 'small' ? 'sm' : 'default'}
      className={cn('gap-3 border-0 p-0', className)}
    >
      <ItemMedia variant="image" className="size-auto rounded-full">
        {avatar}
      </ItemMedia>
      <ItemContent>
        <ItemTitle
          className={cn(
            'line-clamp-none',
            size === 'small' ? 'font-normal' : 'leading-base font-semibold',
          )}
        >
          {title}
        </ItemTitle>
        {description && (
          <ItemDescription className="line-clamp-none text-foreground">
            {description}
          </ItemDescription>
        )}
        {children}
      </ItemContent>
    </Item>
  );
};
