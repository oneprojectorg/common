'use client';

import { NumberField } from '@op/sense/NumberField';

import { useTranslations } from '@/lib/i18n';

import { DEFAULT_TEXT_FIELD_MAX_LENGTH } from '../../../proposalTemplate';
import type { FieldConfigProps } from './fieldRegistry';

// The character limit must be at least this many characters.
const MIN_CHAR_LIMIT = 1;

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

  return (
    <NumberField
      id={`text-char-limit-${field.id}`}
      label={t('Character limit')}
      className="w-32"
      value={value}
      onChange={(next) => onUpdateJsonSchema({ maxLength: next ?? undefined })}
      errorMessage={
        value < MIN_CHAR_LIMIT
          ? t('Must be at least {min}', {
              min: MIN_CHAR_LIMIT.toLocaleString(),
            })
          : undefined
      }
    />
  );
}
