'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import {
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { ToggleButton } from '@op/ui/ToggleButton';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../../../forms/FieldHeader';
import { RubricCriterionSelect } from '../../../forms/RubricCriterionSelect';
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
    <div className="pointer-events-none flex items-center gap-1 px-2 py-1.5 text-base text-primary-teal select-none">
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
                <p className="text-sm text-neutral-charcoal">
                  {schema.description}
                </p>
              )}
              <ToggleButton size="small" className="ms-auto shrink-0" />
            </div>
          </div>
        );
      }

      // Non-scored dropdowns (single-select included) fall through to the
      // generic pill select below, with no points badge.
      const scored = isScoredField(schema);
      const badge = scored ? `${schema.maximum} ${t('pts')}` : undefined;
      const optionsKey = parseSchemaOptions(schema)
        .map((option) => String(option.value))
        .join('|');

      return (
        <div className="flex flex-col gap-3">
          <FieldHeader
            title={schema.title}
            description={schema.description}
            badge={badge}
            className="gap-1"
          />
          <RubricCriterionSelect
            key={optionsKey}
            schema={schema}
            kind={scored ? 'scored' : 'single_select'}
            variant="pill"
            size="medium"
            selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
            className="w-fit max-w-full"
          />
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
            className={`${format === 'long-text' ? 'min-h-32' : 'min-h-8'} text-neutral-gray3`}
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
 * Preview of rubric fields for the builder sidebar.
 * Dropdown, yes/no, and overall-recommendation controls are fully
 * interactive (uncontrolled, never persisted) so builders can see and try
 * the options they've configured. The rationale placeholder stays inert.
 */
export function RubricFormPreviewRenderer({
  fields,
}: {
  fields: FieldDescriptor[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-4">
          <RubricField field={field} />
          <RationalePlaceholder />
        </div>
      ))}
    </div>
  );
}
