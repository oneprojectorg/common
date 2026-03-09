'use client';

import { useEffect, useRef, useState } from 'react';
import { TextField as AriaTextField } from 'react-aria-components';
import type {
  TextFieldProps as AriaTextFieldProps,
  ValidationResult,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import type { InputWithVariantsProps } from './Field';

export interface NumberFieldProps
  extends Omit<
    AriaTextFieldProps,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'onInput'
  > {
  label?: string;
  description?: string;
  /** External error message. Takes precedence over built-in min/max messages. */
  errorMessage?: string | ((validation: ValidationResult) => string);
  inputProps?: InputWithVariantsProps & { className?: string };
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  value?: number | null;
  defaultValue?: number | null;
  prefixText?: string;
  /** Minimum allowed value. Validated on blur with a built-in error message. */
  minValue?: number;
  /** Maximum allowed value. Validated on blur with a built-in error message. */
  maxValue?: number;
  onChange?: (value: number | null) => void;
  onInput?: (value: number | null) => void;
}

const filterNumericInput = (value: string) => {
  return value
    .replace(/[^0-9.-]/g, '') // Keep only digits, minus, and decimal
    .replace(/(?!^)-/g, '') // Remove minus signs that aren't at the beginning
    .replace(/\.(?=.*\.)/g, ''); // Remove decimal points except the last one
};

const parseNumericValue = (value: string) => {
  const filtered = filterNumericInput(value);
  if (filtered === '' || filtered === '-') return null;
  const parsed = parseFloat(filtered);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Validates a numeric value against optional min/max bounds.
 * Returns an error message string if invalid, or `null` if valid.
 */
const validateBounds = (
  numericValue: number | null,
  minValue?: number,
  maxValue?: number,
): string | null => {
  if (numericValue === null) {
    return null;
  }
  if (maxValue !== undefined && numericValue > maxValue) {
    return `Must be at most ${maxValue.toLocaleString()}`;
  }
  if (minValue !== undefined && numericValue < minValue) {
    return `Must be at least ${minValue.toLocaleString()}`;
  }
  return null;
};

export const NumberField = ({
  ref,
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
  children,
  isRequired,
  ...props
}: NumberFieldProps & {
  ref?: React.RefObject<HTMLInputElement | null>;
  children?: React.ReactNode;
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [prefixWidth, setPrefixWidth] = useState(0);
  const [boundsError, setBoundsError] = useState<string | null>(null);
  const prefixRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value?.toString() || '');
    }
  }, [value]);

  useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      setDisplayValue(defaultValue?.toString() || '');
    }
  }, [defaultValue, value]);

  useEffect(() => {
    if (prefixText && prefixRef.current) {
      const updatePrefixWidth = () => {
        if (prefixRef.current) {
          setPrefixWidth(prefixRef.current.offsetWidth);
        }
      };

      updatePrefixWidth();

      const resizeObserver = new ResizeObserver(updatePrefixWidth);
      resizeObserver.observe(prefixRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [prefixText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const filteredValue = filterNumericInput(inputValue);
    const numericValue = parseNumericValue(filteredValue);

    setDisplayValue(filteredValue);
    onChange?.(numericValue);

    // Clear bounds error as soon as the value becomes valid
    if (boundsError && !validateBounds(numericValue, minValue, maxValue)) {
      setBoundsError(null);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const inputValue = target.value;
    const filteredValue = filterNumericInput(inputValue);
    const numericValue = parseNumericValue(filteredValue);

    setDisplayValue(filteredValue);
    onInput?.(numericValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numericValue = parseNumericValue(displayValue);
    setBoundsError(validateBounds(numericValue, minValue, maxValue));
    inputProps?.onBlur?.(e);
  };

  // External errorMessage takes precedence over built-in bounds validation
  const resolvedError = errorMessage ?? boundsError ?? undefined;

  return (
    <AriaTextField
      {...props}
      type="text"
      isInvalid={!!resolvedError && resolvedError.length > 0}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
      )}
    >
      {label && (
        <Label
          className={cn(
            labelClassName,
            'group-data-[invalid=true]:text-functional-red',
          )}
        >
          {label}
          {isRequired && <span className="text-functional-red"> *</span>}
        </Label>
      )}
      <FieldGroup className={cn(fieldClassName, prefixText && 'relative')}>
        {prefixText && (
          <span
            ref={prefixRef}
            className="pointer-events-none absolute top-0 bottom-0 left-0 flex items-center justify-center pr-2 pl-3 text-neutral-gray4 select-none"
          >
            {prefixText}
          </span>
        )}
        <Input
          {...inputProps}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onInput={handleInput}
          onBlur={handleBlur}
          style={{
            paddingLeft: prefixText ? `${prefixWidth}px` : undefined,
          }}
          className={cn(
            inputProps?.className,
            'group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red',
          )}
          ref={ref as React.RefObject<HTMLInputElement>}
        />
        {children}
      </FieldGroup>

      {description && (
        <Description className={descriptionClassName}>
          {description}
        </Description>
      )}
      <FieldError>{resolvedError}</FieldError>
    </AriaTextField>
  );
};
