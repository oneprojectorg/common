'use client';

import { ReactNode } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { cn } from '../lib/utils';
import {
  IconButton,
  IconButtonProps,
  RequireAccessibleName,
} from './IconButton';
import { MenuTrigger } from './Menu';
import { Popover } from './Popover';

type OptionMenuProps = RequireAccessibleName<{
  children: ReactNode;
  className?: string;
  variant?: IconButtonProps['variant'];
  size?: IconButtonProps['size'];
}>;

export const OptionMenu = ({
  children,
  className,
  variant = 'ghost',
  size = 'small',
  ...rest
}: OptionMenuProps) => {
  return (
    <MenuTrigger>
      <IconButton
        {...rest}
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
