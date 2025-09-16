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
          'absolute right-0 top-0 aria-expanded:bg-neutral-gray1',
          className,
        )}
      >
        <LuEllipsis className="size-4" />
      </IconButton>
      <Popover placement="bottom end">{children}</Popover>
    </MenuTrigger>
  );
};
