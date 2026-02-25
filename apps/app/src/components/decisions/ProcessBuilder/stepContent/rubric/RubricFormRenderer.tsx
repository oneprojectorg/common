'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { Select, SelectItem } from '@op/ui/Select';
import { ToggleButton } from '@op/ui/ToggleButton';

import { useTranslations } from '@/lib/i18n';

import type { ProposalFieldDescriptor } from '../../../proposalEditor/compileProposalSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether a dropdown field represents a yes/no toggle.
 * Convention: `type: "string"` with exactly 2 `oneOf` entries whose
 * `const` values are `"yes"` and `"no"`.
 */
function isYesNoField(schema: XFormatPropertySchema): boolean {
  if (schema.type !== 'string' || !Array.isArray(schema.oneOf)) {
    return false;
  }
  if (schema.oneOf.length !== 2) {
    return false;
  }
  const values = new Set(
    schema.oneOf
      .filter(
        (e): e is { const: string } =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as Record<string, unknown>).const === 'string',
      )
      .map((e) => e.const),
  );
  return values.has('yes') && values.has('no');
}

/**
 * Check whether a dropdown field is a scored integer scale (e.g. 1-5 rating).
 * Convention: `type: "integer"` with `oneOf` entries whose `const` are numbers.
 */
function isScoredDropdown(schema: XFormatPropertySchema): boolean {
  return schema.type === 'integer' && Array.isArray(schema.oneOf);
}

/**
 * Extract options from a schema's `oneOf`, handling both string and integer
 * const values. Returns `{ value, label }` pairs suitable for `<Select>`.
 *
 * For integer scales, appends " pts" to the label (e.g. "Excellent (5 pts)").
 */
function extractRubricOptions(
  schema: XFormatPropertySchema,
  ptsLabel: string,
): { value: string; label: string }[] {
  if (!Array.isArray(schema.oneOf)) {
    return [];
  }
  const isScored = isScoredDropdown(schema);

  return schema.oneOf
    .filter(
      (entry): entry is { const: string | number; title: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        'const' in entry &&
        'title' in entry &&
        typeof (entry as Record<string, unknown>).title === 'string',
    )
    .map((entry) => {
      const value = String(entry.const);
      const label =
        isScored && typeof entry.const === 'number'
          ? `${entry.title} (${entry.const} ${ptsLabel})`
          : entry.title;
      return { value, label };
    });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders title and description header for a criterion. */
function CriterionHeader({
  title,
  description,
  maxPoints,
  ptsLabel,
}: {
  title?: string;
  description?: string;
  maxPoints?: number;
  ptsLabel: string;
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
          {maxPoints != null && maxPoints > 0 && (
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

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

/**
 * Renders a single rubric criterion field in preview mode.
 *
 * Dispatches by `x-format` with rubric-specific differentiation:
 * - `dropdown` + `type: "integer"` + `oneOf` -> scored rating scale with "X pts" labels
 * - `dropdown` + yes/no `oneOf` -> toggle switch
 * - `dropdown` + string `oneOf` -> multiple choice select
 * - `short-text` / `long-text` -> text area placeholder
 */
function renderRubricField(
  field: ProposalFieldDescriptor,
  t: (key: string, params?: Record<string, string | number>) => string,
): React.ReactNode {
  const { format, schema } = field;
  const ptsLabel = t('pts');

  switch (format) {
    case 'dropdown': {
      // Yes/No toggle
      if (isYesNoField(schema)) {
        return (
          <div className="flex flex-col gap-3">
            <CriterionHeader
              title={schema.title}
              description={schema.description}
              ptsLabel={ptsLabel}
            />
            <ToggleButton size="small" />
          </div>
        );
      }

      // Scored integer scale or plain multiple choice
      const maxPoints = isScoredDropdown(schema)
        ? typeof schema.maximum === 'number'
          ? schema.maximum
          : 0
        : 0;
      const options = extractRubricOptions(schema, ptsLabel);

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

    case 'short-text': {
      return (
        <div className="flex flex-col gap-3">
          <CriterionHeader
            title={schema.title}
            description={schema.description}
            ptsLabel={ptsLabel}
          />
          <div className="min-h-8 text-neutral-gray3">
            {t('Start typing...')}
          </div>
        </div>
      );
    }

    case 'long-text': {
      return (
        <div className="flex flex-col gap-3">
          <CriterionHeader
            title={schema.title}
            description={schema.description}
            ptsLabel={ptsLabel}
          />
          <div className="min-h-32 text-neutral-gray3">
            {t('Start typing...')}
          </div>
        </div>
      );
    }

    default: {
      console.warn(
        `[RubricFormRenderer] Unimplemented x-format "${format}" for field "${field.key}"`,
      );
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// RubricFormRenderer
// ---------------------------------------------------------------------------

/**
 * Schema-driven form renderer for rubric preview.
 *
 * Takes compiled field descriptors (same shape as proposal fields) and
 * renders the correct rubric-specific component for each criterion.
 * Always renders in static preview mode (non-interactive).
 *
 * Unlike `ProposalFormRenderer`, rubrics have no system fields — all
 * criteria are rendered in a flat vertical stack.
 */
export function RubricFormRenderer({
  fields,
}: {
  fields: ProposalFieldDescriptor[];
}) {
  const t = useTranslations();

  return (
    <div className="pointer-events-none flex flex-col gap-6">
      {fields.map((field) => (
        <div key={field.key}>{renderRubricField(field, t)}</div>
      ))}
    </div>
  );
}
