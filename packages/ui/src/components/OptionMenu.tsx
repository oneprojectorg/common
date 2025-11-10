'use client';

import { ReactNode } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { IconButton, IconButtonProps } from './IconButton';
import { MenuTrigger } from './Menu';
import { Popover } from './Popover';

export const OptionMenu = ({
  children,
  className,
  variant = 'ghost',
  size = 'small',
}: {
  children: ReactNode;
  className?: string;
  variant?: IconButtonProps['variant'];
  size?: IconButtonProps['size'];
}) => {
  return (
    <MenuTrigger>
      <IconButton
        variant={variant}
        size={size}
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
