'use client';

import { ChevronDown } from 'lucide-react';
import {
  Select as AriaSelect,
  Button,
  ListBox,
  SelectValue,
} from 'react-aria-components';
import type {
  SelectProps as AriaSelectProps,
  ListBoxItemProps,
  ValidationResult,
} from 'react-aria-components';
import { VariantProps, tv } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { Description, FieldError, Label } from './Field';
import { DropdownItem, DropdownSection } from './ListBox';
import type { DropdownSectionProps } from './ListBox';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

const selectStyles = tv({
  base: 'flex h-10 min-w-0 flex-row justify-between rounded-md border border-neutral-gray1 p-3 text-base leading-3 text-neutral-black outline outline-0 placeholder:text-neutral-gray4 group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red active:border-neutral-gray4 active:outline hover:border-neutral-gray2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue disabled:border-neutral-gray2',
  variants: {
    isDisabled: {
      true: 'bg-neutral-gray1 text-neutral-gray4',
      false: '',
    },
    variant: {
      default: '',
      pill: 'h-auto border-0 bg-primary-tealWhite p-2 text-primary-teal active:bg-teal-50 active:text-primary-tealBlack hover:bg-teal-50 hover:text-primary-tealBlack focus-visible:outline-data-blue',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const chevronStyles = tv({
  base: 'ml-2 size-4',
  variants: {
    variant: {
      default: 'text-neutral-charcoal group-disabled:text-neutral-gray4',
      pill: 'hidden',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type SelectVariantsProps = VariantProps<typeof selectStyles>;

export interface SelectProps<T extends object>
  extends Omit<AriaSelectProps<T>, 'children'>,
    SelectVariantsProps {
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
  variant?: 'default' | 'pill';
}

export const Select = <T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  selectionMode = 'single',
  isRequired,
  variant = 'default',
  ...props
}: SelectProps<T>) => {
  return (
    <AriaSelect
      {...props}
      isInvalid={!!errorMessage && errorMessage.length > 0}
      className={cn('flex flex-col gap-1', props.className)}
    >
      {label && (
        <Label className="group-data-[invalid=true]:text-functional-red">
          {label}{' '}
          {isRequired && <span className="text-functional-red"> *</span>}
        </Label>
      )}

      {props.customTrigger ? (
        props.customTrigger
      ) : (
        <Button
          className={cn(
            selectStyles({ ...props, variant } as SelectVariantsProps),
            props.buttonClassName,
          )}
        >
          <span className="flex h-full w-full flex-1 items-center gap-1">
            <SelectValue
              className={cn(
                props.selectValueClassName,
                'flex h-full items-center',
              )}
            />
            <ChevronDown aria-hidden className={chevronStyles({ variant })} />
          </span>
        </Button>
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        className="absolute z-10 !max-h-60 min-w-[--trigger-width] max-w-56 overflow-hidden rounded border border-neutral-gray1 bg-white p-2 shadow"
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
