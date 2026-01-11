'use client';

import { ChevronDown } from 'lucide-react';
import { ReactNode } from 'react';
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
  base: 'min-w-0 leading-3 flex flex-row justify-between rounded-md border text-base text-neutral-black outline outline-0 group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red placeholder:text-neutral-gray4 hover:border-neutral-gray2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue active:border-neutral-gray4 active:outline disabled:border-neutral-gray2',
  variants: {
    isDisabled: {
      true: 'bg-neutral-gray1 text-neutral-gray4',
      false: '',
    },
    variant: {
      default: '',
      pill: 'h-auto border-0 bg-primary-tealWhite text-primary-teal hover:bg-teal-50 hover:text-primary-tealBlack focus-visible:outline-data-blue active:bg-teal-50 active:text-primary-tealBlack',
    },
    size: {
      small: 'h-8 p-2 px-3 rounded-sm',
      medium: 'h-10 p-3',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'medium',
  },
});

const chevronStyles = tv({
  base: 'ml-2 size-4 min-h-4 min-w-4',
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
  icon?: ReactNode;
  size?: 'small' | 'medium';
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
  size,
  icon,
  ...props
}: SelectProps<T>) => {
  const { className: popoverClassName, ...popoverProps } =
    props.popoverProps || {};

  return (
    <AriaSelect
      {...props}
      isInvalid={!!errorMessage && errorMessage.length > 0}
      className={cn('gap-1 flex flex-col', props.className)}
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
            selectStyles({ ...props, variant, size } as SelectVariantsProps),
            props.buttonClassName,
          )}
        >
          <span className="gap-1 flex h-full w-full flex-1 items-center justify-between">
            <SelectValue
              className={cn(
                props.selectValueClassName,
                'min-w-0 flex h-full flex-1 items-center text-ellipsis text-neutral-gray4',
              )}
            />
            {icon ?? (
              <ChevronDown aria-hidden className={chevronStyles({ variant })} />
            )}
          </span>
        </Button>
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        className={cn(
          '!max-h-60 max-w-56 p-2 absolute z-10 min-w-(--trigger-width) overflow-hidden rounded border bg-white shadow',
          popoverClassName,
        )}
        {...popoverProps}
      >
        <ListBox
          items={items}
          className={cn(
            'max-h-60 py-1 overflow-auto outline-hidden',
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
