'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { Select, SelectItem } from '@op/ui/Select';
import { ToggleButton } from '@op/ui/ToggleButton';

import { useTranslations } from '@/lib/i18n';

import type { FieldDescriptor } from '../../../forms/types';

type OneOfEntry = { const: string | number; title: string };

/** Narrow a `oneOf` entry to a typed `{ const, title }` pair. */
function isOneOfEntry(entry: unknown): entry is OneOfEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'const' in entry &&
    'title' in entry &&
    typeof (entry as OneOfEntry).title === 'string'
  );
}

/** Yes/no toggle: `type: "string"` with exactly `"yes"` and `"no"` entries. */
function isYesNoField(schema: XFormatPropertySchema): boolean {
  if (
    schema.type !== 'string' ||
    !Array.isArray(schema.oneOf) ||
    schema.oneOf.length !== 2
  ) {
    return false;
  }
  const values = new Set(schema.oneOf.filter(isOneOfEntry).map((e) => e.const));
  return values.has('yes') && values.has('no');
}

/** Scored integer scale (e.g. 1-5 rating). */
function isScoredDropdown(schema: XFormatPropertySchema): boolean {
  return schema.type === 'integer' && Array.isArray(schema.oneOf);
}

/** Extract `{ value, label }` pairs from `oneOf`. Appends point labels for scored fields. */
function extractOptions(
  schema: XFormatPropertySchema,
  ptsLabel: string,
): { value: string; label: string }[] {
  if (!Array.isArray(schema.oneOf)) {
    return [];
  }

  const scored = isScoredDropdown(schema);

  return schema.oneOf.filter(isOneOfEntry).map((entry) => ({
    value: String(entry.const),
    label:
      scored && typeof entry.const === 'number'
        ? `${entry.title} (${entry.const} ${ptsLabel})`
        : entry.title,
  }));
}

/** Title + description header for a criterion, with optional point badge. */
function CriterionHeader({
  title,
  description,
  maxPoints,
  ptsLabel,
}: {
  title?: string;
  description?: string;
  maxPoints?: number;
  ptsLabel?: string;
}) {
  if (!title && !description) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {title && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-title-sm14 text-neutral-charcoal">
            {title}
          </span>
          {maxPoints != null && maxPoints > 0 && ptsLabel && (
            <span className="shrink-0 text-xs text-neutral-gray4">
              {maxPoints} {ptsLabel}
            </span>
          )}
        </div>
      )}
      {description && (
        <p className="text-sm text-neutral-charcoal">{description}</p>
      )}
    </div>
  );
}

/** Renders a single rubric criterion based on its `x-format`. */
function RubricField({ field }: { field: FieldDescriptor }) {
  const t = useTranslations();
  const { format, schema } = field;
  const ptsLabel = t('pts');

  switch (format) {
    case 'dropdown': {
      if (isYesNoField(schema)) {
        return (
          <div className="flex flex-col gap-3">
            <CriterionHeader
              title={schema.title}
              description={schema.description}
            />
            <ToggleButton size="small" />
          </div>
        );
      }

      const maxPoints = isScoredDropdown(schema)
        ? typeof schema.maximum === 'number'
          ? schema.maximum
          : 0
        : 0;
      const options = extractOptions(schema, ptsLabel);

      return (
        <div className="flex flex-col gap-3">
          <CriterionHeader
            title={schema.title}
            description={schema.description}
            maxPoints={maxPoints}
            ptsLabel={ptsLabel}
          />
          <Select
            variant="pill"
            size="medium"
            placeholder={t('Select option')}
            selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
            className="w-auto max-w-56 overflow-hidden sm:max-w-96"
          >
            {options.map((opt) => (
              <SelectItem className="min-w-fit" key={opt.value} id={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>
      );
    }

    case 'short-text':
    case 'long-text': {
      return (
        <div className="flex flex-col gap-3">
          <CriterionHeader
            title={schema.title}
            description={schema.description}
          />
          <div
            className={`${format === 'long-text' ? 'min-h-32' : 'min-h-8'} text-neutral-gray3`}
          >
            {t('Start typing...')}
          </div>
        </div>
      );
    }

    default: {
      console.warn(
        `[RubricFormRenderer] Unsupported x-format "${format}" for "${field.key}"`,
      );
      return null;
    }
  }
}

/**
 * Schema-driven form renderer for rubric preview.
 * Renders compiled field descriptors as a static, non-interactive vertical stack.
 */
export function RubricFormRenderer({ fields }: { fields: FieldDescriptor[] }) {
  return (
    <div className="pointer-events-none flex flex-col gap-6">
      {fields.map((field) => (
        <RubricField key={field.key} field={field} />
      ))}
    </div>
  );
}
