'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import {
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { Select } from '@op/ui/Select';
import { ToggleButton } from '@op/ui/ToggleButton';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../../../forms/FieldHeader';
import type { FieldDescriptor } from '../../../forms/types';

/** Yes/no field: `type: "string"` with exactly `"yes"` and `"no"` oneOf entries. */
function isYesNoField(schema: XFormatPropertySchema): boolean {
  if (
    schema.type !== 'string' ||
    !Array.isArray(schema.oneOf) ||
    schema.oneOf.length !== 2
  ) {
    return false;
  }
  const values = schema.oneOf
    .filter(
      (e): e is { const: string } =>
        typeof e === 'object' && e !== null && 'const' in e,
    )
    .map((e) => e.const);
  return values.includes('yes') && values.includes('no');
}

/** Scored integer scale (e.g. 1-5 rating). */
function isScoredField(schema: XFormatPropertySchema): boolean {
  return schema.type === 'integer' && typeof schema.maximum === 'number';
}

/** Collapsed "Add Note" affordance mirroring the review form default state. */
function RationalePlaceholder() {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 text-base text-primary">
      <LuPlus className="size-4" />
      {t('Add Note')}
    </div>
  );
}

/** Static placeholder for a single rubric criterion. */
function RubricField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { format, schema } = field;

  // Horizontal radio group for the overall recommendation field.
  if (isOverallRecommendationField(field.key)) {
    const recOptions = parseSchemaOptions(schema);
    return (
      <div className="flex flex-col gap-3">
        <FieldHeader title={schema.title} />
        <RadioGroup
          className="gap-0"
          aria-label={schema.title}
          orientation="horizontal"
        >
          {recOptions.map((option) => (
            <Radio key={String(option.value)} value={String(option.value)}>
              {option.title || String(option.value)}
            </Radio>
          ))}
        </RadioGroup>
      </div>
    );
  }

  switch (format) {
    case 'dropdown': {
      if (isYesNoField(schema)) {
        return (
          <div className="flex flex-col gap-3">
            <FieldHeader
              title={schema.title}
              badge={t('No/Yes')}
              className="gap-1"
            />
            <div className="flex items-center gap-3">
              {schema.description && (
                <p className="text-sm text-foreground">{schema.description}</p>
              )}
              <ToggleButton size="sm" className="ml-auto shrink-0" />
            </div>
          </div>
        );
      }

      const badge = isScoredField(schema)
        ? `${schema.maximum} ${t('pts')}`
        : undefined;

      return (
        <div className="flex flex-col gap-3">
          <FieldHeader
            title={schema.title}
            description={schema.description}
            badge={badge}
            className="gap-1"
          />
          <Select
            placeholder={t('Select option')}
            className="w-auto max-w-56 overflow-hidden sm:max-w-96"
          >
            {[]}
          </Select>
        </div>
      );
    }

    case 'short-text':
    case 'long-text': {
      return (
        <div className="flex flex-col gap-3">
          <FieldHeader
            title={schema.title}
            description={schema.description}
            className="gap-1"
          />
          <div
            className={`${format === 'long-text' ? 'min-h-32' : 'min-h-8'} text-muted-foreground`}
          >
            {t('Start typing...')}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Static read-only preview of rubric fields.
 * Shows field labels and placeholder inputs — no interactivity.
 * Rationale placeholder is rendered under every criterion.
 */
export function RubricFormPreviewRenderer({
  fields,
}: {
  fields: FieldDescriptor[];
}) {
  return (
    <div className="pointer-events-none flex flex-col gap-6">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-4">
          <RubricField field={field} />
          <RationalePlaceholder />
        </div>
      ))}
    </div>
  );
}
