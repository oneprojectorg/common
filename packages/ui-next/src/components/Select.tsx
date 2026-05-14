// Compat wrapper for @op/ui's Select. Wraps shadcn base-nova Select with
// the legacy composite API (label + description + errorMessage + items
// iterable + render-function children + variant/size).
//
// For `selectionMode='multiple'` consumers, point them at MultiSelectComboBox
// — shadcn Select is single-only.

'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { Field, FieldDescription, FieldError, FieldLabel } from './ui/field';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem as ShadcnSelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export interface SelectProps<T extends { id: string | number }> {
  label?: string;
  description?: string;
  errorMessage?: string;
  items?: Iterable<T>;
  children: React.ReactNode | ((item: T) => React.ReactNode);
  className?: string;
  labelClassName?: string;
  buttonClassName?: string;
  listBoxClassName?: string;
  selectValueClassName?: string;
  placeholder?: string;
  variant?: 'default' | 'pill';
  size?: 'small' | 'medium';
  isRequired?: boolean;
  isDisabled?: boolean;
  value?: string;
  defaultValue?: string;
  onSelectionChange?: (value: string | null) => void;
  customTrigger?: React.ReactNode;
  name?: string;
  id?: string;
}

export function Select<T extends { id: string | number }>({
  label,
  description,
  errorMessage,
  items,
  children,
  className,
  labelClassName,
  buttonClassName,
  listBoxClassName,
  selectValueClassName,
  placeholder,
  variant = 'default',
  size = 'medium',
  isRequired,
  isDisabled,
  value,
  defaultValue,
  onSelectionChange,
  customTrigger,
  name,
  id,
}: SelectProps<T>) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const isInvalid = !!errorMessage;

  const itemsArray = items ? Array.from(items) : undefined;

  const renderedItems: React.ReactNode =
    typeof children === 'function'
      ? itemsArray
        ? itemsArray.map((item) =>
            (children as (item: T) => React.ReactNode)(item),
          )
        : null
      : children;

  // Pass items to base-ui Select.Root so SelectValue can resolve the
  // selected item's display label from its `value`.
  const baseUiItems = itemsArray?.map((i) => ({
    value: String(i.id),
    label: (i as { label?: React.ReactNode }).label,
  }));

  return (
    <Field data-invalid={isInvalid} className={cn('gap-1', className)}>
      {label && (
        <FieldLabel htmlFor={fieldId} className={labelClassName}>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}
      <ShadcnSelect
        value={value}
        defaultValue={defaultValue}
        onValueChange={onSelectionChange}
        disabled={isDisabled}
        name={name}
        items={baseUiItems}
      >
        {customTrigger ?? (
          <SelectTrigger
            id={fieldId}
            size={size === 'small' ? 'sm' : 'default'}
            className={cn(
              variant === 'pill' &&
                'border-0 bg-primary/10 text-primary hover:bg-primary/15',
              buttonClassName,
            )}
          >
            <SelectValue
              placeholder={placeholder}
              className={selectValueClassName}
            />
          </SelectTrigger>
        )}
        <SelectContent
          alignItemWithTrigger={false}
          className={listBoxClassName}
        >
          {renderedItems}
        </SelectContent>
      </ShadcnSelect>
      {description && !errorMessage && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
    </Field>
  );
}

export interface SelectItemProps extends React.ComponentProps<
  typeof ShadcnSelectItem
> {
  id?: string;
}

export function SelectItem({ id, value, ...props }: SelectItemProps) {
  return <ShadcnSelectItem value={value ?? id ?? ''} {...props} />;
}

export { SelectGroup, SelectLabel, SelectSeparator } from './ui/select';
