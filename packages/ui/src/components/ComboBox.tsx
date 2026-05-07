'use client';

import { ReactNode, useContext } from 'react';
import {
  ComboBox as AriaComboBox,
  ComboBoxStateContext,
  ListBox,
} from 'react-aria-components';
import type {
  ComboBoxProps as AriaComboBoxProps,
  ListBoxItemProps,
  ValidationResult,
} from 'react-aria-components';
import { LuChevronDown } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Button } from './Button';
import type { ButtonProps } from './Button';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import { DropdownItem, DropdownSection } from './ListBox';
import type { DropdownSectionProps } from './ListBox';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

export interface ComboBoxProps<T extends object> extends Omit<
  AriaComboBoxProps<T>,
  'children'
> {
  label?: string;
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: React.ReactNode | ((item: T) => React.ReactNode);
  labelClassName?: string;
  inputClassName?: string;
  listBoxClassName?: string;
  fieldGroupClassName?: string;
  buttonProps?: Omit<ButtonProps, 'children'>;
  popoverProps?: Omit<PopoverProps, 'children'>;
  icon?: ReactNode;
  placeholder?: string;
}

export const ComboBox = <T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
  icon,
  placeholder,
  ...props
}: ComboBoxProps<T>) => {
  return (
    <AriaComboBox
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
      )}
    >
      <Label className={props.labelClassName}>{label}</Label>
      <FieldGroup className={cn('relative', props.fieldGroupClassName)}>
        <ComboBoxInput
          className={props.inputClassName}
          placeholder={placeholder}
        />
        <Button
          variant="icon"
          color="ghost"
          {...props.buttonProps}
          className={cn(
            'absolute top-1/2 right-1 aspect-square w-6 -translate-y-1/2 p-0',
            props.buttonProps?.className,
          )}
        >
          {icon ?? <LuChevronDown aria-hidden className="size-4" />}
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        {...props.popoverProps}
        className={cn(
          'absolute z-10 !max-h-60 min-w-(--trigger-width) overflow-hidden rounded border bg-white p-2 shadow',
          props.popoverProps?.className,
        )}
      >
        <ListBox
          items={items}
          className={cn(
            'max-h-60 overflow-auto py-1 outline-hidden',
            props.listBoxClassName,
          )}
        >
          {children}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
};

const ComboBoxInput = ({
  className,
  placeholder,
}: {
  className?: string;
  placeholder?: string;
}) => {
  const state = useContext(ComboBoxStateContext);
  return (
    <Input
      className={className}
      placeholder={placeholder}
      onClick={() => state?.open()}
    />
  );
};

export const ComboBoxItem = (
  props: ListBoxItemProps & { className?: string },
) => {
  return <DropdownItem {...props} />;
};

export const ComboBoxSection = <T extends object>(
  props: DropdownSectionProps<T>,
) => {
  return <DropdownSection {...props} />;
};
