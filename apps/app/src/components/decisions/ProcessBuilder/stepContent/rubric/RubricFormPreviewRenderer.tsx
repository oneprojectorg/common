'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { Select } from '@op/ui/Select';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../../../forms/FieldHeader';
import type { FieldDescriptor } from '../../../forms/types';

/** Scored integer scale (e.g. 1-5 rating). */
function isScoredField(schema: XFormatPropertySchema): boolean {
  return schema.type === 'integer' && typeof schema.maximum === 'number';
}

/** Static placeholder for a single rubric criterion. */
function RubricField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { format, schema } = field;

  switch (format) {
    case 'dropdown': {
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
