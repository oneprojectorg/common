'use client';

import { ChevronDown } from 'lucide-react';
import {
  Select as AriaSelect,
  Button,
  ListBox,
  SelectValue,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps, focusRing } from '../utils';

import { Description, FieldError, Label } from './Field';
import { DropdownItem, DropdownSection } from './ListBox';
import { Popover } from './Popover';

import type { DropdownSectionProps } from './ListBox';
import type { PopoverProps } from './Popover';
import type {
  SelectProps as AriaSelectProps,
  ListBoxItemProps,
  ValidationResult,
} from 'react-aria-components';

const styles = tv({
  extend: focusRing,
  base: 'flex w-full min-w-[150px] cursor-default items-center gap-4 rounded-lg border-2 border-neutral-500 bg-neutral-100 px-2 py-1.5 text-start shadow-none transition',
  variants: {
    isDisabled: {
      false:
        'text-neutral-700 group-invalid:border-red-600 hover:bg-neutral-200 pressed:bg-neutral-200',
      true: 'border-white/5 bg-neutral-200 text-neutral-400',
    },
  },
});

export interface SelectProps<T extends object>
  extends Omit<AriaSelectProps<T>, 'children'> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  items?: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
  labelClassName?: string;
  listBoxClassName?: string;
  buttonClassName?: string;
  selectValueClassName?: string;
  customTrigger?: React.ReactNode;
  popoverProps?: Omit<PopoverProps, 'children'>;
  selectionMode?: 'single' | 'multiple';
}

export const Select = <T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  selectionMode = 'single',
  ...props
}: SelectProps<T>) => {
  return (
    <AriaSelect
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1 text-neutral-950',
      )}
    >
      {label && <Label>{label}</Label>}
      {props.customTrigger ? (
        props.customTrigger
      ) : (
        <Button className={cn(styles(), props.buttonClassName)}>
          <SelectValue
            className={cn(
              'flex-1 truncate placeholder-shown:text-neutral-500',
              props.selectValueClassName,
            )}
          />

          <ChevronDown
            aria-hidden
            className="size-[1em] text-neutral-600 group-disabled:text-neutral-400"
          />
        </Button>
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        className="!max-h-96 min-w-[--trigger-width]"
        {...props.popoverProps}
      >
        <ListBox
          items={items}
          className={cn(
            'max-h-[inherit] overflow-auto p-1 outline-none [clip-path:inset(0_0_0_0_round_.75rem)]',
            props.listBoxClassName,
          )}
          selectionMode={selectionMode}
        >
          {children}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
};

export const SelectItem = (
  props: ListBoxItemProps & { className?: string },
) => {
  return <DropdownItem {...props} />;
};

export const SelectSection = <T extends object>(
  props: DropdownSectionProps<T>,
) => {
  return <DropdownSection {...props} />;
};
