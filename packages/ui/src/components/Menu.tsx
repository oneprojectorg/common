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

import { VariantProps, cn, tv } from '../lib/utils';
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
        'p-2 max-h-[inherit] overflow-auto rounded-sm border bg-white text-neutral-charcoal shadow-light outline outline-0',
        props.className,
      )}
    />
  );
};

export const menuItemStyles = tv({
  base: 'group gap-4 px-4 py-2 flex cursor-pointer items-center rounded-sm text-neutral-charcoal outline outline-0 -outline-offset-1 forced-color-adjust-none select-none',
  variants: {
    unstyled: {
      true: 'group px-0 py-0 pb-0 pl-0 pr-0 pt-0 flex cursor-pointer items-center text-neutral-charcoal outline outline-0 -outline-offset-1 forced-color-adjust-none select-none',
      false: '',
    },
    selected: {
      true: 'bg-primary-tealWhite outline-1 outline-primary-teal',
      false: '',
    },
    isDisabled: {
      false: 'text-neutral-black',
      true: 'text-neutral-400',
    },
    isFocused: {
      true: 'bg-neutral-offWhite outline-1 outline-neutral-gray1',
    },
  },
  compoundVariants: [
    {
      isFocused: false,
      isOpen: true,
      className: 'bg-neutral-gray1',
    },
  ],
});
type MenuItemVariants = VariantProps<typeof menuItemStyles>;

export const MenuItem = (
  props: Omit<MenuItemProps, 'className'> & {
    className?: string;
  } & MenuItemVariants,
) => {
  return (
    <AriaMenuItem
      {...props}
      className={(renderProps) =>
        menuItemStyles({
          ...renderProps,
          selected: props.selected,
          className: props.className,
          unstyled: props.unstyled,
        })
      }
    >
      {composeRenderProps(
        props.children,
        (children, { selectionMode, isSelected, hasSubmenu }) => (
          <>
            {selectionMode !== 'none' && (
              <span className="w-4 flex items-center">
                {isSelected && <Check aria-hidden className="size-4" />}
              </span>
            )}
            <span className="group-selected:font-semibold gap-2 font-normal flex flex-1 items-center truncate">
              {children}
            </span>
            {hasSubmenu && (
              <ChevronRight aria-hidden className="right-2 size-4 absolute" />
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
    <Separator {...props} className={cn('my-1 border-b', props.className)} />
  );
};

export const MenuSection = <T extends object>(
  props: DropdownSectionProps<T>,
) => {
  return <DropdownSection {...props} />;
};
