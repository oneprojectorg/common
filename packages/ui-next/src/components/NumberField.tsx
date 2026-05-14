// Compat wrapper for @op/ui's NumberField. Wraps shadcn Input typed as text
// (matches legacy implementation), with numeric filtering, min/max bounds
// validation on blur, optional currency-style prefix text.

'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/utils';
import { Field, FieldDescription, FieldError, FieldLabel } from './ui/field';
import { Input } from './ui/input';

export interface NumberFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string;
  inputProps?: React.ComponentProps<typeof Input> & { className?: string };
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  value?: number | null;
  defaultValue?: number | null;
  prefixText?: string;
  minValue?: number;
  maxValue?: number;
  onChange?: (value: number | null) => void;
  onInput?: (value: number | null) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  name?: string;
  id?: string;
}

const filterNumeric = (v: string) =>
  v
    .replace(/[^0-9.-]/g, '')
    .replace(/(?!^)-/g, '')
    .replace(/\.(?=.*\.)/g, '');

const parseNumeric = (v: string) => {
  const f = filterNumeric(v);
  if (f === '' || f === '-') return null;
  const n = parseFloat(f);
  return Number.isNaN(n) ? null : n;
};

const checkBounds = (
  n: number | null,
  min?: number,
  max?: number,
): string | null => {
  if (n === null) return null;
  if (max !== undefined && n > max)
    return `Must be at most ${max.toLocaleString()}`;
  if (min !== undefined && n < min)
    return `Must be at least ${min.toLocaleString()}`;
  return null;
};

export function NumberField({
  label,
  description,
  errorMessage,
  inputProps,
  fieldClassName,
  descriptionClassName,
  labelClassName,
  value,
  defaultValue,
  prefixText,
  minValue,
  maxValue,
  onChange,
  onInput,
  isRequired,
  isDisabled,
  className,
  children,
  name,
  id,
}: NumberFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const [displayValue, setDisplayValue] = useState('');
  const [prefixWidth, setPrefixWidth] = useState(0);
  const [boundsError, setBoundsError] = useState<string | null>(null);
  const prefixRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value !== undefined) setDisplayValue(value?.toString() ?? '');
  }, [value]);

  useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      setDisplayValue(defaultValue?.toString() ?? '');
    }
  }, [defaultValue, value]);

  useEffect(() => {
    if (!prefixText || !prefixRef.current) return;
    const update = () => {
      if (prefixRef.current) setPrefixWidth(prefixRef.current.offsetWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(prefixRef.current);
    return () => ro.disconnect();
  }, [prefixText]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = filterNumeric(e.target.value);
    const n = parseNumeric(filtered);
    setDisplayValue(filtered);
    onChange?.(n);
    if (boundsError && !checkBounds(n, minValue, maxValue))
      setBoundsError(null);
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const t = e.target as HTMLInputElement;
    const filtered = filterNumeric(t.value);
    const n = parseNumeric(filtered);
    setDisplayValue(filtered);
    onInput?.(n);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const n = parseNumeric(displayValue);
    setBoundsError(checkBounds(n, minValue, maxValue));
    inputProps?.onBlur?.(e);
  };

  const resolvedError = errorMessage ?? boundsError ?? undefined;
  const isInvalid = !!resolvedError;

  return (
    <Field data-invalid={isInvalid} className={cn('gap-1', className)}>
      {label && (
        <FieldLabel htmlFor={fieldId} className={labelClassName}>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}
      <div className={cn(fieldClassName, 'relative')}>
        {prefixText && (
          <span
            ref={prefixRef}
            className="text-muted-foreground pointer-events-none absolute top-0 bottom-0 left-0 flex items-center justify-center pr-2 pl-3 select-none"
          >
            {prefixText}
          </span>
        )}
        <Input
          id={fieldId}
          name={name}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onInput={handleInput}
          onBlur={handleBlur}
          aria-invalid={isInvalid || undefined}
          disabled={isDisabled}
          required={isRequired}
          style={{ paddingLeft: prefixText ? `${prefixWidth}px` : undefined }}
          {...inputProps}
          className={cn(inputProps?.className)}
        />
        {children}
      </div>
      {description && (
        <FieldDescription className={descriptionClassName}>
          {description}
        </FieldDescription>
      )}
      {resolvedError && <FieldError>{resolvedError}</FieldError>}
    </Field>
  );
}
