'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { isRationaleField } from '@op/common/client';
import { Select } from '@op/ui/Select';
import { ToggleButton } from '@op/ui/ToggleButton';

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

/** Compact rationale textarea rendered inline under a parent criterion. */
function RationaleField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { schema } = field;
  const isRequired = true; // rationale fields are required when present in schema

  return (
    <div className="-mt-3 flex flex-col gap-1.5">
      <span className="text-sm font-medium text-neutral-charcoal">
        {schema.title ?? t('Reason(s) and Insight(s)')}
        {isRequired && (
          <span className="text-feedback-error ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className="min-h-20 rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-sm text-neutral-gray3">
        {t('Placeholder')}
      </div>
    </div>
  );
}

/** Static placeholder for a single rubric criterion. */
function RubricField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { format, schema } = field;

  if (isRationaleField(field.key)) {
    return <RationaleField field={field} />;
  }

  switch (format) {
    case 'dropdown': {
      if (isYesNoField(schema)) {
        return (
          <div className="flex flex-col gap-3">
            <FieldHeader
              title={schema.title}
              badge={t('Yes/No')}
              className="gap-1"
            />
            <div className="flex items-start gap-3">
              <ToggleButton size="small" className="shrink-0" />
              {schema.description && (
                <p className="text-sm text-neutral-charcoal">
                  {schema.description}
                </p>
              )}
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
            variant="pill"
            size="medium"
            placeholder={t('Select option')}
            selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
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
 * Static read-only preview of rubric fields.
 * Shows field labels and placeholder inputs — no interactivity.
 */
export function RubricFormPreviewRenderer({
  fields,
}: {
  fields: FieldDescriptor[];
}) {
  return (
    <div className="pointer-events-none flex flex-col gap-6">
      {fields.map((field) => (
        <RubricField key={field.key} field={field} />
      ))}
    </div>
  );
}
