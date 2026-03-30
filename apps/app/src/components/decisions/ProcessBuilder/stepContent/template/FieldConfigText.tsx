'use client';

import { NumberField } from '@op/ui/NumberField';

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
    typeof fieldSchema.maxLength === 'number'
      ? fieldSchema.maxLength
      : defaultMaxLength;

  return (
    <NumberField
      label={t('Character limit')}
      value={value}
      minValue={1}
      onChange={(nextValue) => {
        onUpdateJsonSchema({
          maxLength: nextValue ?? undefined,
        });
      }}
      inputProps={{
        className: 'bg-white',
      }}
    />
  );
}
