// Compat wrapper for @op/ui's TextField. Composes shadcn primitives:
// FieldLabel + Input/Textarea + FieldDescription + FieldError.
// Preserves legacy `useTextArea` mode and `maxLength` char counter.

'use client';

import * as React from 'react';
import { useState } from 'react';

import { cn } from '../lib/utils';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Field, FieldDescription, FieldError, FieldLabel } from './ui/field';

type InputElementProps = Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange'
>;
type TextareaElementProps = Omit<
  React.ComponentProps<typeof Textarea>,
  'value' | 'defaultValue' | 'onChange'
>;

export interface TextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string;
  inputProps?: InputElementProps & { className?: string };
  textareaProps?: TextareaElementProps & { className?: string };
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  useTextArea?: boolean;
  maxLength?: number;
  isRequired?: boolean;
  isDisabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
  name?: string;
  id?: string;
  ref?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
  autoFocus?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  >;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  'aria-label'?: string;
}

export function TextField({
  label,
  description,
  errorMessage,
  inputProps,
  textareaProps,
  fieldClassName,
  descriptionClassName,
  labelClassName,
  errorClassName,
  useTextArea,
  maxLength,
  isRequired,
  isDisabled,
  value,
  defaultValue,
  onChange,
  className,
  children,
  name,
  id,
  ref,
  autoFocus,
  onBlur,
  onFocus,
  onKeyDown,
  placeholder,
  type,
  'aria-label': ariaLabel,
}: TextFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const isControlled = value !== undefined;
  const [uncontrolledCount, setUncontrolledCount] = useState(
    () => (defaultValue ?? '').length,
  );
  const charCount = isControlled ? (value?.length ?? 0) : uncontrolledCount;
  const isInvalid = !!errorMessage;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!isControlled) {
      setUncontrolledCount(e.target.value.length);
    }
    onChange?.(e.target.value);
  };

  const counterEl = maxLength != null && (
    <span
      className={cn(
        'text-muted-foreground text-sm',
        isDisabled && 'opacity-50',
        (charCount === maxLength || isInvalid) && 'text-destructive',
      )}
    >
      {charCount}/{maxLength}
    </span>
  );

  return (
    <Field data-invalid={isInvalid} className={cn('gap-1', className)}>
      {label && (
        <FieldLabel htmlFor={fieldId} className={labelClassName}>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}
      <div className={cn(fieldClassName)}>
        {useTextArea ? (
          <Textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={fieldId}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onBlur={onBlur as React.FocusEventHandler<HTMLTextAreaElement>}
            onFocus={onFocus as React.FocusEventHandler<HTMLTextAreaElement>}
            onKeyDown={
              onKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>
            }
            maxLength={maxLength}
            aria-invalid={isInvalid || undefined}
            aria-label={ariaLabel}
            disabled={isDisabled}
            required={isRequired}
            autoFocus={autoFocus}
            placeholder={placeholder}
            {...textareaProps}
            className={cn(textareaProps?.className)}
          />
        ) : (
          <Input
            ref={ref as React.Ref<HTMLInputElement>}
            id={fieldId}
            name={name}
            type={type}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onBlur={onBlur as React.FocusEventHandler<HTMLInputElement>}
            onFocus={onFocus as React.FocusEventHandler<HTMLInputElement>}
            onKeyDown={
              onKeyDown as React.KeyboardEventHandler<HTMLInputElement>
            }
            maxLength={maxLength}
            aria-invalid={isInvalid || undefined}
            aria-label={ariaLabel}
            disabled={isDisabled}
            required={isRequired}
            autoFocus={autoFocus}
            placeholder={placeholder}
            {...inputProps}
            className={cn(inputProps?.className)}
          />
        )}
        {children}
      </div>
      {(description || errorMessage || counterEl) && (
        <div className="flex items-baseline justify-between gap-4">
          <div>
            {description && !errorMessage && (
              <FieldDescription className={descriptionClassName}>
                {description}
              </FieldDescription>
            )}
            {errorMessage && (
              <FieldError className={errorClassName}>{errorMessage}</FieldError>
            )}
          </div>
          {counterEl}
        </div>
      )}
    </Field>
  );
}
