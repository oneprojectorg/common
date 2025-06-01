'use client';

import { Check, ChevronRight } from 'lucide-react';
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger as AriaMenuTrigger,
  Separator,
  composeRenderProps,
} from 'react-aria-components';
import type {
  MenuProps as AriaMenuProps,
  MenuItemProps,
  SeparatorProps,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { DropdownSection, dropdownItemStyles } from './ListBox';
import type { DropdownSectionProps } from './ListBox';
import type { PopoverProps } from './Popover';

export { AriaMenuTrigger as MenuTrigger };

interface MenuProps<T> extends AriaMenuProps<T> {
  placement?: PopoverProps['placement'];
}

export const Menu = <T extends object>(props: MenuProps<T>) => {
  return (
    <AriaMenu
      {...props}
      className={cn(
        'max-h-[inherit] overflow-auto border bg-white p-1 py-1.5 text-neutral-charcoal outline outline-0 [clip-path:inset(0_0_0_0_round_.75rem)]',
        props.className,
      )}
    />
  );
};

export const MenuItem = (
  props: Omit<MenuItemProps, 'className'> & { className?: string },
) => {
  return (
    <AriaMenuItem
      {...props}
      className={(renderProps) =>
        dropdownItemStyles({ ...renderProps, className: props.className })
      }
    >
      {composeRenderProps(
        props.children,
        (children, { selectionMode, isSelected, hasSubmenu }) => (
          <>
            {selectionMode !== 'none' && (
              <span className="flex w-4 items-center">
                {isSelected && <Check aria-hidden className="size-4" />}
              </span>
            )}
            <span className="flex flex-1 items-center gap-2 truncate font-normal group-selected:font-semibold">
              {children}
            </span>
            {hasSubmenu && (
              <ChevronRight aria-hidden className="absolute right-2 size-4" />
            )}
          </>
        ),
      )}
    </AriaMenuItem>
  );
};

export const MenuItemSimple = (
  props: Omit<MenuItemProps, 'className'> & { className?: string },
) => {
  return (
    <AriaMenuItem
      {...props}
      className={(renderProps) =>
        dropdownItemStyles({ ...renderProps, className: props.className })
      }
    />
  );
};

export const MenuSeparator = (props: SeparatorProps) => {
  return (
    <Separator
      {...props}
      className="mx-3 my-1 border-b border-neutral-offWhite"
    />
  );
};

export const MenuSection = <T extends object>(
  props: DropdownSectionProps<T>,
) => {
  return <DropdownSection {...props} />;
};
