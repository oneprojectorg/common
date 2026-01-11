'use client';

import { ChevronDown } from 'lucide-react';
import { ComboBox as AriaComboBox, ListBox } from 'react-aria-components';
import type {
  ComboBoxProps as AriaComboBoxProps,
  ListBoxItemProps,
  ValidationResult,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Button } from './Button';
import type { ButtonProps } from './Button';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import { DropdownItem, DropdownSection } from './ListBox';
import type { DropdownSectionProps } from './ListBox';
import { Popover } from './Popover';
import type { PopoverProps } from './Popover';

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
        'group gap-1 flex flex-col',
      )}
    >
      <Label className={props.labelClassName}>{label}</Label>
      <FieldGroup className={cn('relative', props.fieldGroupClassName)}>
        <Input className={props.inputClassName} />
        <Button
          variant="icon"
          color="ghost"
          {...props.buttonProps}
          className={cn(
            'right-1 w-6 p-0 absolute top-1/2 aspect-square -translate-y-1/2',
            props.buttonProps?.className,
          )}
        >
          <ChevronDown aria-hidden className="size-4" />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        {...props.popoverProps}
        className={cn(
          'min-w-[--trigger-width] bg-white',
          props.popoverProps?.className,
        )}
      >
        <ListBox
          items={items}
          className={cn(
            'p-1 max-h-[inherit] overflow-auto outline-0 [clip-path:inset(0_0_0_0_round_.75rem)]',
            props.listBoxClassName,
          )}
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
