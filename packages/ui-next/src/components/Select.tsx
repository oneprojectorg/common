// Compat wrapper for @op/ui's Select. Wraps shadcn base-nova Select with
// the legacy composite API (label + description + errorMessage + items
// iterable + render-function children + variant/size).
//
// For `selectionMode='multiple'` consumers, point them at MultiSelectComboBox
// — shadcn Select is single-only.

'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
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
  /** Legacy alias for `value` (RAC naming). */
  selectedKey?: string | null;
  /** Legacy alias for `defaultValue` (RAC naming). */
  defaultSelectedKey?: string | null;
  onSelectionChange?: (value: string | null) => void;
  customTrigger?: React.ReactNode;
  name?: string;
  id?: string;
  'aria-label'?: string;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  /** Legacy popover overrides (RAC). Accepted for source-compat; ignored. */
  popoverProps?: { className?: string; [key: string]: unknown };
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
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  customTrigger,
  name,
  id,
  'aria-label': ariaLabel,
  onBlur: _onBlur,
  popoverProps: _popoverProps,
}: SelectProps<T>) {
  const resolvedValue = value ?? selectedKey ?? undefined;
  const resolvedDefault = defaultValue ?? defaultSelectedKey ?? undefined;
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
  // selected item's display label from its `value`. Works for both
  // function-rendered items and static <SelectItem> children.
  const baseUiItems = React.useMemo(() => {
    if (itemsArray) {
      return itemsArray.map((i) => ({
        value: String(i.id),
        label: (i as { label?: React.ReactNode }).label,
      }));
    }
    // Introspect static children to extract value → label mapping.
    const items: Array<{ value: string; label: React.ReactNode }> = [];
    React.Children.forEach(renderedItems, (child) => {
      if (!React.isValidElement(child)) return;
      const props = child.props as {
        value?: string;
        id?: string | number;
        children?: React.ReactNode;
      };
      const value = props.value ?? (props.id != null ? String(props.id) : null);
      if (value != null) {
        items.push({ value, label: props.children });
      }
    });
    return items.length ? items : undefined;
  }, [itemsArray, renderedItems]);

  const needsField = !!label || !!description || !!errorMessage;
  const selectRoot = (
    <ShadcnSelect
      value={resolvedValue ?? undefined}
      defaultValue={resolvedDefault ?? undefined}
      onValueChange={onSelectionChange}
      disabled={isDisabled}
      name={name}
      items={baseUiItems}
      modal={false}
    >
      {customTrigger ? (
        <SelectPrimitive.Trigger
          id={fieldId}
          aria-label={ariaLabel}
          render={customTrigger as React.ReactElement}
        />
      ) : (
        <SelectTrigger
          id={fieldId}
          size={size === 'small' ? 'sm' : 'default'}
          aria-label={ariaLabel}
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
      <SelectContent alignItemWithTrigger={false} className={listBoxClassName}>
        {renderedItems}
      </SelectContent>
    </ShadcnSelect>
  );

  if (!needsField) {
    return <div className={cn('w-fit', className)}>{selectRoot}</div>;
  }

  return (
    <Field data-invalid={isInvalid} className={cn('gap-1', className)}>
      {label && (
        <FieldLabel htmlFor={fieldId} className={labelClassName}>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}
      {selectRoot}
      {description && !errorMessage && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
    </Field>
  );
}

export interface SelectItemProps extends Omit<
  React.ComponentProps<typeof ShadcnSelectItem>,
  'value'
> {
  id?: string;
  value?: string;
  /** Legacy alias for `disabled` (RAC naming). */
  isDisabled?: boolean;
  /** Accessible text representation of the item (RAC ListBox naming). */
  textValue?: string;
}

export function SelectItem({
  id,
  value,
  isDisabled,
  disabled,
  textValue: _textValue,
  ...props
}: SelectItemProps) {
  return (
    <ShadcnSelectItem
      value={value ?? id ?? ''}
      disabled={disabled ?? isDisabled}
      {...props}
    />
  );
}

export { SelectGroup, SelectLabel, SelectSeparator } from './ui/select';
