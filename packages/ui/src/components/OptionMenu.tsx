'use client';

import { ReactNode } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { IconButton } from './IconButton';
import { MenuTrigger } from './Menu';
import { Popover } from './Popover';

export const OptionMenu = ({ children }: { children: ReactNode }) => {
  return (
    <MenuTrigger>
      <IconButton
        variant="ghost"
        size="small"
        className="absolute right-0 top-0 aria-expanded:bg-neutral-gray1"
      >
        <LuEllipsis className="size-4" />
      </IconButton>
      <Popover placement="bottom end">{children}</Popover>
    </MenuTrigger>
  );
};
