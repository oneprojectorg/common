'use client';

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
import { LuCheck, LuChevronRight } from 'react-icons/lu';

import { VariantProps, cn, tv } from '../lib/utils';
import { DropdownSection, dropdownItemStyles } from './ListBox';
import type { DropdownSectionProps } from './ListBox';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

export { AriaMenuTrigger as MenuTrigger };

const menuListClasses =
  'max-h-[inherit] overflow-auto rounded-md border bg-white p-2 text-neutral-charcoal shadow-light outline outline-0';

export const MenuList = <T extends object>(props: AriaMenuProps<T>) => {
  return (
    <AriaMenu {...props} className={cn(menuListClasses, props.className)} />
  );
};

interface MenuProps<T> extends AriaMenuProps<T> {
  placement?: PopoverProps['placement'];
  showArrow?: PopoverProps['showArrow'];
  offset?: PopoverProps['offset'];
  popoverClassName?: PopoverProps['className'];
}

export const Menu = <T extends object>({
  placement,
  showArrow,
  offset,
  popoverClassName,
  ...menuProps
}: MenuProps<T>) => {
  return (
    <Popover
      placement={placement}
      showArrow={showArrow}
      offset={offset}
      className={popoverClassName}
    >
      <MenuList {...menuProps} />
    </Popover>
  );
};

export const menuItemStyles = tv({
  base: 'group flex cursor-pointer items-center gap-4 rounded-md px-4 py-2 text-neutral-charcoal outline outline-0 -outline-offset-1 forced-color-adjust-none select-none',
  variants: {
    unstyled: {
      true: 'px-0 py-0',
    },
    selected: {
      true: 'bg-primary-tealWhite outline-1 outline-primary-teal',
    },
    isDisabled: {
      false: 'text-neutral-black',
      true: 'text-neutral-gray2',
    },
    isHovered: {
      true: 'bg-neutral-offWhite',
    },
    isFocusVisible: {
      true: 'outline-2 outline-primary-teal',
    },
  },
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
              <span className="flex w-4 items-center">
                {isSelected && <LuCheck aria-hidden className="size-4" />}
              </span>
            )}
            <span className="flex flex-1 items-center gap-2 truncate font-normal group-selected:font-semibold">
              {children}
            </span>
            {hasSubmenu && (
              <LuChevronRight aria-hidden className="absolute right-2 size-4" />
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
