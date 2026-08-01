'use client';

import { Field, FieldError, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DEFAULT_TEXT_FIELD_MAX_LENGTH } from '../../../proposalTemplate';
import type { FieldConfigProps } from './fieldRegistry';

// The character limit must be at least this many characters.
const MIN_CHAR_LIMIT = 1;

// Numeric-input helpers ported from the former @op/ui NumberField (sense has no
// NumberField equivalent). They normalize non-ASCII numerals to ASCII so the
// field accepts Arabic-Indic / Persian digits, then keep only valid numeric
// characters.
const normalizeDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/٬/g, ''); // Arabic thousands separator

const filterNumericInput = (value: string) =>
  normalizeDigits(value)
    .replace(/[^0-9.-]/g, '') // Keep only digits, minus, and decimal
    .replace(/(?!^)-/g, '') // Remove minus signs that aren't at the beginning
    .replace(/\.(?=.*\.)/g, ''); // Remove decimal points except the last one

const parseNumericValue = (value: string): number | null => {
  const filtered = filterNumericInput(value);
  if (filtered === '' || filtered === '-') {
    return null;
  }
  const parsed = parseFloat(filtered);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Field config component for text fields.
 * Stores the character limit directly on the field schema as `maxLength`.
 */
export function FieldConfigText({
  field,
  fieldSchema,
  onUpdateJsonSchema,
}: FieldConfigProps) {
  const t = useTranslations();
  const defaultMaxLength =
    field.fieldType === 'long_text'
      ? DEFAULT_TEXT_FIELD_MAX_LENGTH.long_text
      : DEFAULT_TEXT_FIELD_MAX_LENGTH.short_text;
  const value =
    typeof fieldSchema.maxLength === 'number'
      ? fieldSchema.maxLength
      : defaultMaxLength;

  const inputId = `text-char-limit-${field.id}`;
  const [display, setDisplay] = useState(value.toString());
  const [boundsError, setBoundsError] = useState<string | null>(null);

  // Keep the display value in sync when the stored value changes externally.
  useEffect(() => {
    setDisplay(value.toString());
  }, [value]);

  const validateBounds = (numericValue: number | null): string | null => {
    if (numericValue !== null && numericValue < MIN_CHAR_LIMIT) {
      return t('Must be at least {min}', {
        min: MIN_CHAR_LIMIT.toLocaleString(),
      });
    }
    return null;
  };

  return (
    <Field data-invalid={!!boundsError}>
      <FieldLabel htmlFor={inputId}>{t('Character limit')}</FieldLabel>
      <Input
        id={inputId}
        inputMode="numeric"
        dir="ltr"
        value={display}
        onChange={(e) => {
          const filtered = filterNumericInput(e.target.value);
          setDisplay(filtered);
          const nextValue = parseNumericValue(filtered);
          onUpdateJsonSchema({ maxLength: nextValue ?? undefined });
          // Clear the bounds error as soon as the value becomes valid.
          if (boundsError && !validateBounds(nextValue)) {
            setBoundsError(null);
          }
        }}
        onBlur={() =>
          setBoundsError(validateBounds(parseNumericValue(display)))
        }
        aria-invalid={!!boundsError}
        className="bg-white"
      />
      {boundsError && <FieldError>{boundsError}</FieldError>}
    </Field>
  );
}
