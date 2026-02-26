'use client';

import { Select } from '@op/ui/Select';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../../../forms/FieldHeader';
import type { FieldDescriptor } from '../../../forms/types';

/** Static placeholder for a single rubric criterion. */
function RubricField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { format, schema } = field;

  switch (format) {
    case 'dropdown': {
      return (
        <div className="flex flex-col gap-3">
          <FieldHeader title={schema.title} description={schema.description} />
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
          <FieldHeader title={schema.title} description={schema.description} />
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
