'use client';

import { TextField } from '@op/ui/TextField';

import { useTranslations } from '@/lib/i18n';

import { DEFAULT_TEXT_FIELD_MAX_LENGTH } from '../../../proposalTemplate';
import type { FieldConfigProps } from './fieldRegistry';

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
    typeof fieldSchema.maxLength === 'number' ? String(fieldSchema.maxLength) : '';

  return (
    <TextField
      label={t('Character limit')}
      value={value}
      onChange={(nextValue) => {
        const digitsOnly = nextValue.replace(/\D/g, '');

        onUpdateJsonSchema({
          maxLength: digitsOnly ? Number(digitsOnly) : undefined,
        });
      }}
      description={t('Default: {count} characters', {
        count: defaultMaxLength,
      })}
      inputProps={{
        inputMode: 'numeric',
        pattern: '[0-9]*',
        placeholder: t('Set character limit'),
        className: 'bg-white',
      }}
    />
  );
}
