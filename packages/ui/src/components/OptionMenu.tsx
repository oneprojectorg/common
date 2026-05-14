'use client';

import { ReactNode } from 'react';
import type { MenuProps as AriaMenuProps } from 'react-aria-components';
import { LuEllipsis } from 'react-icons/lu';

import { RequireAccessibleName } from '../lib/a11y';
import { cn } from '../lib/utils';
import { IconButton, IconButtonProps } from './IconButton';
import { Menu, MenuTrigger } from './Menu';
import type { PopoverProps } from './Popover';

type OptionMenuProps<T extends object> = RequireAccessibleName<{
  children: ReactNode;
  className?: string;
  variant?: IconButtonProps['variant'];
  size?: IconButtonProps['size'];
  placement?: PopoverProps['placement'];
  popoverClassName?: PopoverProps['className'];
  menuClassName?: string;
  onAction?: AriaMenuProps<T>['onAction'];
}>;

export const OptionMenu = <T extends object>({
  children,
  className,
  variant = 'ghost',
  size = 'small',
  placement = 'bottom end',
  popoverClassName,
  menuClassName,
  onAction,
  ...rest
}: OptionMenuProps<T>) => {
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
      <Menu
        placement={placement}
        popoverClassName={popoverClassName}
        className={cn('min-w-28 p-2', menuClassName)}
        onAction={onAction}
      >
        {children}
      </Menu>
    </MenuTrigger>
  );
};
