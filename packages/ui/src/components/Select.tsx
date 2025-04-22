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
  base: 'flex w-full min-w-[150px] cursor-default items-center gap-2 rounded-md border border-offWhite bg-white p-4 text-sm text-black placeholder:text-midGray shadow-none transition text-start',
  variants: {
    isDisabled: {
      false:
        'text-black group-invalid:border-red-600 hover:bg-offWhite pressed:bg-offWhite',
      true: 'border-neutral-300 bg-offWhite text-neutral-400',
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
        <Button className={cn(styles(), 'justify-start', props.buttonClassName)}>
          <SelectValue
            className={cn(
              'flex-1 truncate text-left placeholder-shown:text-neutral-500',
              props.selectValueClassName,
            )}
          />
          <ChevronDown
            aria-hidden
            className="size-4 text-charcoal group-disabled:text-neutral-400 ml-2"
          />
        </Button>
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        className="absolute z-10 mt-1 min-w-[--trigger-width] w-[--trigger-width] rounded-md border border-gray-200 bg-white shadow-lg !max-h-60"
        {...props.popoverProps}
      >
        <ListBox
          items={items}
          className={cn(
            'max-h-60 overflow-auto py-1 outline-none',
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
