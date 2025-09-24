'use client';

import { ReactNode } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { IconButton } from './IconButton';
import { MenuTrigger } from './Menu';
import { Popover } from './Popover';

export const OptionMenu = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <MenuTrigger>
      <IconButton
        variant="ghost"
        size="small"
        className={cn(
          'aspect-square aria-expanded:bg-neutral-gray1',
          className,
        )}
      >
        <LuEllipsis className="size-4" />
      </IconButton>
      <Popover placement="bottom end">{children}</Popover>
    </MenuTrigger>
  );
};
