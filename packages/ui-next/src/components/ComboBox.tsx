// Compat wrapper for @op/ui's ComboBox. Single-select Combobox via vanilla
// shadcn base-ui Combobox primitives.

'use client';

import * as React from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from './ui/field';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './ui/combobox';
import { cn } from '../lib/utils';

export interface ComboBoxProps<T extends { id: string | number }> {
  label?: string;
  description?: string | null;
  errorMessage?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  listBoxClassName?: string;
  fieldGroupClassName?: string;
  popoverProps?: { className?: string; [key: string]: unknown };
  placeholder?: string;
  items: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
  selectedKey?: string | null;
  defaultSelectedKey?: string | null;
  onSelectionChange?: (key: string | null) => void;
  isDisabled?: boolean;
}

export function ComboBox<T extends { id: string | number }>({
  label,
  description,
  errorMessage,
  className,
  labelClassName,
  inputClassName,
  listBoxClassName,
  popoverProps,
  placeholder,
  items,
  children,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  isDisabled,
}: ComboBoxProps<T>) {
  const itemsArray = Array.from(items);
  const fieldId = React.useId();
  const isInvalid = !!errorMessage;

  const renderedItems =
    typeof children === 'function'
      ? itemsArray.map((item) => (children as (item: T) => React.ReactNode)(item))
      : children;

  const baseUiItems = itemsArray.map((i) => ({
    value: String(i.id),
    label: '',
  }));

  return (
    <Field data-invalid={isInvalid} className={cn('gap-1', className)}>
      {label && (
        <FieldLabel htmlFor={fieldId} className={labelClassName}>
          {label}
        </FieldLabel>
      )}
      <Combobox<{ value: string; label: string }>
        items={baseUiItems}
        itemToStringValue={(i) => i.value}
        value={
          selectedKey != null
            ? baseUiItems.find((i) => i.value === selectedKey) ?? null
            : defaultSelectedKey != null
              ? baseUiItems.find((i) => i.value === defaultSelectedKey) ?? null
              : null
        }
        onValueChange={(next) => onSelectionChange?.(next?.value ?? null)}
        disabled={isDisabled}
      >
        <ComboboxInput
          id={fieldId}
          placeholder={placeholder}
          className={inputClassName}
        />
        <ComboboxContent className={cn(popoverProps?.className)}>
          <ComboboxEmpty>No options</ComboboxEmpty>
          <ComboboxList className={listBoxClassName}>
            {renderedItems}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {description && !errorMessage && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
    </Field>
  );
}

export interface ComboBoxItemProps {
  id: string;
  textValue?: string;
  children: React.ReactNode;
  className?: string;
}

export function ComboBoxItem({
  id,
  textValue: _textValue,
  children,
  className,
}: ComboBoxItemProps) {
  return (
    <ComboboxItem value={{ value: id, label: '' }} className={className}>
      {children}
    </ComboboxItem>
  );
}
