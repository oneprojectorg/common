'use client';

import { ReactNode } from 'react';
import type { MenuProps as AriaMenuProps } from 'react-aria-components';
import { LuEllipsis } from 'react-icons/lu';

import { RequireAccessibleName } from '../lib/a11y';
import { cn } from '../lib/utils';
import { IconButton, IconButtonProps } from './IconButton';
import { MenuList, MenuTrigger } from './Menu';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

type OptionMenuProps = RequireAccessibleName<{
  children: ReactNode;
  className?: string;
  variant?: IconButtonProps['variant'];
  size?: IconButtonProps['size'];
  placement?: PopoverProps['placement'];
  popoverClassName?: PopoverProps['className'];
  menuClassName?: string;
  onAction?: AriaMenuProps<object>['onAction'];
}>;

export const OptionMenu = ({
  children,
  className,
  variant = 'ghost',
  size = 'small',
  placement = 'bottom end',
  popoverClassName,
  menuClassName,
  onAction,
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
      <Popover placement={placement} className={popoverClassName}>
        <MenuList
          className={cn('min-w-28 p-2', menuClassName)}
          onAction={onAction}
        >
          {children}
        </MenuList>
      </Popover>
    </MenuTrigger>
  );
};
