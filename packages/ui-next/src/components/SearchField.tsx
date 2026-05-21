// Compat wrapper for @op/ui's SearchField. Wraps shadcn InputGroup with a
// leading search icon and trailing clear button.

'use client';

import * as React from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Field, FieldDescription, FieldError, FieldLabel } from './ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './ui/input-group';

export interface SearchFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  size?: 'small';
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  isDisabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
}

export function SearchField({
  label,
  description,
  errorMessage,
  placeholder,
  size: _size,
  value,
  defaultValue,
  onChange,
  onClear,
  isDisabled,
  className,
  name,
  id,
}: SearchFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const current = isControlled ? value : internal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternal(e.target.value);
    onChange?.(e.target.value);
  };

  const handleClear = () => {
    if (!isControlled) setInternal('');
    onChange?.('');
    onClear?.();
  };

  return (
    <Field data-invalid={!!errorMessage} className={cn('gap-1', className)}>
      {label && <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>}
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <LuSearch aria-hidden className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          id={fieldId}
          name={name}
          type="search"
          placeholder={placeholder}
          value={current}
          onChange={handleChange}
          disabled={isDisabled}
          className="[&::-webkit-search-cancel-button]:hidden"
        />
        {current && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              aria-label="Clear search"
              onClick={handleClear}
              size="icon-xs"
              variant="ghost"
            >
              <LuX aria-hidden className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      {description && !errorMessage && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
    </Field>
  );
}
