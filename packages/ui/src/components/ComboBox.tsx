'use client';

import { ChevronDown } from 'lucide-react';
import {
  ComboBox as AriaComboBox,
  ListBox,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';

import { Button } from './Button';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import { DropdownItem, DropdownSection } from './ListBox';
import { Popover } from './Popover';

import type { ButtonProps } from './Button';
import type { DropdownSectionProps } from './ListBox';
import type { PopoverProps } from './Popover';
import type {
  ComboBoxProps as AriaComboBoxProps,
  ListBoxItemProps,
  ValidationResult,
} from 'react-aria-components';

export interface ComboBoxProps<T extends object>
  extends Omit<AriaComboBoxProps<T>, 'children'> {
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
}

export const ComboBox = <T extends object>({
  label,
  description,
  errorMessage,
  children,
  items,
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
      <FieldGroup className={props.fieldGroupClassName}>
        <Input className={props.inputClassName} />
        <Button
          variant="icon"
          padding="none"
          {...props.buttonProps}
          className={cn('mr-1 aspect-square w-6 rounded outline-offset-0', props.buttonProps?.className)}
        >
          <ChevronDown aria-hidden className="size-[1em]" />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover className="min-w-[--trigger-width]">
        <ListBox
          items={items}
          className={cn('max-h-[inherit] overflow-auto p-1 outline-0 [clip-path:inset(0_0_0_0_round_.75rem)]', props.listBoxClassName)}
        >
          {children}
        </ListBox>
      </Popover>
    </AriaComboBox>
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
