'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { RequiredAsterisk } from '../RequiredAsterisk';
import { FieldDescription, FieldError, FieldLabel } from '../ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../ui/input-group';

interface NumberFieldProps extends Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'onInput'
> {
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  onInput?: (value: number | null) => void;
  /** Minimum allowed value. Validated on blur with a built-in message. */
  minValue?: number;
  /** Maximum allowed value. Validated on blur with a built-in message. */
  maxValue?: number;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** External error message. Takes precedence over min/max messages. */
  errorMessage?: React.ReactNode;
  /** Static text rendered at the inline start of the input (e.g. "$"). */
  prefixText?: string;
  className?: string;
}

function NumberField({
  value,
  defaultValue,
  onChange,
  onInput,
  minValue,
  maxValue,
  label,
  description,
  errorMessage,
  prefixText,
  required,
  disabled,
  id,
  className,
  onBlur,
  ...inputProps
}: NumberFieldProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;

  const [displayValue, setDisplayValue] = React.useState(
    () => value?.toString() ?? defaultValue?.toString() ?? '',
  );
  const [boundsError, setBoundsError] = React.useState<string | null>(null);

  // Follow external value changes when controlled.
  React.useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value?.toString() ?? '');
    }
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = filterNumericInput(event.target.value);
    const numeric = parseNumericValue(filtered);

    setDisplayValue(filtered);
    onChange?.(numeric);
    onInput?.(numeric);

    // Clear the bounds error as soon as the value becomes valid.
    if (boundsError && !validateBounds(numeric, minValue, maxValue)) {
      setBoundsError(null);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setBoundsError(
      validateBounds(parseNumericValue(displayValue), minValue, maxValue),
    );
    onBlur?.(event);
  };

  const resolvedError = errorMessage ?? boundsError;

  return (
    <div
      data-slot="number-field"
      className={cn('flex flex-col gap-1', className)}
    >
      {label ? (
        <FieldLabel htmlFor={inputId}>
          {label}
          {required ? <RequiredAsterisk /> : null}
        </FieldLabel>
      ) : null}
      <InputGroup>
        {prefixText ? (
          <InputGroupAddon align="inline-start">
            <InputGroupText>{prefixText}</InputGroupText>
          </InputGroupAddon>
        ) : null}
        <InputGroupInput
          {...inputProps}
          id={inputId}
          type="text"
          inputMode="decimal"
          // Numeric content is always rendered as ASCII (see normalizeDigits),
          // so the input stays LTR even in RTL locales.
          dir="ltr"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          aria-invalid={resolvedError ? true : undefined}
        />
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {resolvedError ? <FieldError>{resolvedError}</FieldError> : null}
    </div>
  );
}

// Normalize non-ASCII numerals to ASCII so the field accepts Arabic input.
// Arabic-Indic (U+0660–0669) and Extended Arabic-Indic/Persian (U+06F0–06F9)
// digits map to ASCII; Arabic decimal/thousands separators map to `.`/``.
function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/٬/g, ''); // Arabic thousands separator
}

function filterNumericInput(value: string) {
  return normalizeDigits(value)
    .replace(/[^0-9.-]/g, '') // Keep only digits, minus, and decimal
    .replace(/(?!^)-/g, '') // Remove minus signs that aren't at the beginning
    .replace(/\.(?=.*\.)/g, ''); // Remove decimal points except the last one
}

function parseNumericValue(value: string) {
  const filtered = filterNumericInput(value);
  if (filtered === '' || filtered === '-') {
    return null;
  }
  const parsed = parseFloat(filtered);
  return isNaN(parsed) ? null : parsed;
}

function validateBounds(
  numericValue: number | null,
  minValue?: number,
  maxValue?: number,
): string | null {
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
}

export { NumberField };
