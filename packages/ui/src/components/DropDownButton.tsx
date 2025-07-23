'use client';

import { ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { Menu, MenuItem, MenuTrigger } from './Menu';
import { Popover } from './Popover';

const dropdownButtonStyle = tv({
  base: 'flex h-10 w-fit items-center justify-center gap-1 rounded-lg border border-solid p-4 text-center text-sm font-normal leading-6 shadow-md outline-none duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightGray',
  variants: {
    color: {
      primary:
        'bg-primary-teal text-neutral-offWhite hover:bg-primary-tealBlack pressed:bg-primary-tealBlack pressed:text-neutral-gray2',
      secondary:
        'border-primary-teal bg-white text-primary-teal hover:bg-neutral-50 pressed:bg-white',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-30',
      false: '',
    },
  },
  defaultVariants: {
    color: 'secondary',
  },
});

type DropdownButtonVariants = VariantProps<typeof dropdownButtonStyle>;

export interface DropdownButtonItem {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  onAction?: () => void;
}

export interface DropdownButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'onPress'>,
    DropdownButtonVariants {
  label: string | ReactNode;
  items: DropdownButtonItem[];
  chevronIcon?: ReactNode;
  className?: string;
  matchTriggerWidth?: boolean;
}

export const DropDownButton = (props: DropdownButtonProps) => {
  const {
    label,
    items,
    chevronIcon,
    className,
    matchTriggerWidth = true,
    ...rest
  } = props;

  return (
    <MenuTrigger>
      <Button
        {...rest}
        className={dropdownButtonStyle({ ...props, className })}
      >
        {label}
        {chevronIcon}
      </Button>
      <Popover
        placement="bottom start"
        className={matchTriggerWidth ? 'min-w-[--trigger-width]' : undefined}
      >
        <Menu>
          {items.map((item) => (
            <MenuItem key={item.id} onAction={item.onAction} className="pr-3">
              <div className="flex items-center gap-2">
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="text-sm text-neutral-charcoal">
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};
