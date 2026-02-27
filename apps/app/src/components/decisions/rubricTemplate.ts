/**
 * Rubric Template — JSON Schema utilities.
 *
 * Uses `RubricTemplateSchema` from `@op/common`. Field ordering is stored as a
 * top-level `x-field-order` array. Per-criterion widget selection is driven by
 * `x-format` on each property (consumed by the renderer's rubric field logic).
 *
 * Mirrors the architecture of `proposalTemplate.ts` but tailored to rubric
 * criteria: scored dropdowns, yes/no, custom dropdowns, and long text.
 */
import type {
  RubricTemplateSchema,
  XFormatPropertySchema,
} from '@op/common/client';

export type { RubricTemplateSchema };

// ---------------------------------------------------------------------------
// Criterion types
// ---------------------------------------------------------------------------

export type RubricCriterionType =
  | 'scored'
  | 'yes_no'
  | 'dropdown'
  | 'long_text';

/**
 * Flat read-only view of a single rubric criterion, derived from the template.
 * Gives builder/renderer code a friendly object instead of requiring
 * multiple reader calls per criterion.
 */
export interface CriterionView {
  id: string;
  criterionType: RubricCriterionType;
  label: string;
  description?: string;
  required: boolean;
  /** Maximum points for scored criteria. */
  maxPoints?: number;
  /** Labels for each score level (index 0 = score 1). Scored criteria only. */
  scoreLabels: string[];
  /** Options for dropdown criteria. */
  options: { id: string; value: string }[];
}

// ---------------------------------------------------------------------------
// Criterion type ↔ JSON Schema mapping
// ---------------------------------------------------------------------------

const DEFAULT_MAX_POINTS = 5;

const DEFAULT_SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

/**
 * Create the JSON Schema for a given criterion type.
 */
export function createCriterionJsonSchema(
  type: RubricCriterionType,
): XFormatPropertySchema {
  switch (type) {
    case 'scored': {
      const max = DEFAULT_MAX_POINTS;
      const oneOf = Array.from({ length: max }, (_, i) => ({
        const: i + 1,
        title: DEFAULT_SCORE_LABELS[i + 1] ?? `${i + 1}`,
      }));
      return {
        type: 'integer',
        'x-format': 'dropdown',
        minimum: 1,
        maximum: max,
        oneOf,
      };
    }
    case 'yes_no':
      return {
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'yes', title: 'Yes' },
          { const: 'no', title: 'No' },
        ],
      };
    case 'dropdown':
      return {
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'Option 1', title: 'Option 1' },
          { const: 'Option 2', title: 'Option 2' },
        ],
      };
    case 'long_text':
      return {
        type: 'string',
        'x-format': 'long-text',
      };
  }
}

// ---------------------------------------------------------------------------
// Type inference from schema shape
// ---------------------------------------------------------------------------

/**
 * Infer the `RubricCriterionType` from a raw JSON Schema property.
 */
export function inferCriterionType(
  schema: XFormatPropertySchema,
): RubricCriterionType | undefined {
  const xFormat = schema['x-format'];

  if (xFormat === 'long-text') {
    return 'long_text';
  }

  if (xFormat === 'dropdown') {
    // Scored: integer type with maximum
    if (schema.type === 'integer' && typeof schema.maximum === 'number') {
      return 'scored';
    }

    // Yes/No: string with exactly two oneOf entries (yes, no)
    if (schema.type === 'string' && Array.isArray(schema.oneOf)) {
      const values = schema.oneOf
        .filter(
          (e): e is { const: string } =>
            typeof e === 'object' && e !== null && 'const' in e,
        )
        .map((e) => e.const);
      if (
        values.length === 2 &&
        values.includes('yes') &&
        values.includes('no')
      ) {
        return 'yes_no';
      }
    }

    // Generic dropdown
    if (schema.type === 'string') {
      return 'dropdown';
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function asSchema(def: unknown): XFormatPropertySchema | undefined {
  if (typeof def === 'object' && def !== null) {
    return def as XFormatPropertySchema;
  }
  return undefined;
}

export function getCriterionOrder(template: RubricTemplateSchema): string[] {
  return (template['x-field-order'] as string[] | undefined) ?? [];
}

export function getCriterionSchema(
  template: RubricTemplateSchema,
  criterionId: string,
): XFormatPropertySchema | undefined {
  const props = template.properties;
  if (!props) {
    return undefined;
  }
  return asSchema(props[criterionId]);
}

export function getCriterionType(
  template: RubricTemplateSchema,
  criterionId: string,
): RubricCriterionType | undefined {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema) {
    return undefined;
  }
  return inferCriterionType(schema);
}

export function getCriterionLabel(
  template: RubricTemplateSchema,
  criterionId: string,
): string {
  const schema = getCriterionSchema(template, criterionId);
  return (schema?.title as string | undefined) ?? '';
}

export function getCriterionDescription(
  template: RubricTemplateSchema,
  criterionId: string,
): string | undefined {
  const schema = getCriterionSchema(template, criterionId);
  return schema?.description;
}

export function isCriterionRequired(
  template: RubricTemplateSchema,
  criterionId: string,
): boolean {
  const required = template.required;
  if (!Array.isArray(required)) {
    return false;
  }
  return required.includes(criterionId);
}

export function getCriterionMaxPoints(
  template: RubricTemplateSchema,
  criterionId: string,
): number | undefined {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || schema.type !== 'integer') {
    return undefined;
  }
  return schema.maximum;
}

export function getCriterionScoreLabels(
  template: RubricTemplateSchema,
  criterionId: string,
): string[] {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || schema.type !== 'integer' || !Array.isArray(schema.oneOf)) {
    return [];
  }
  return schema.oneOf
    .filter(
      (e): e is { const: number; title: string } =>
        typeof e === 'object' &&
        e !== null &&
        'const' in e &&
        'title' in e &&
        typeof (e as { title: unknown }).title === 'string',
    )
    .sort((a, b) => a.const - b.const)
    .map((e) => e.title);
}

export function getCriterionOptions(
  template: RubricTemplateSchema,
  criterionId: string,
): { id: string; value: string }[] {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || schema.type !== 'string' || !Array.isArray(schema.oneOf)) {
    return [];
  }
  return schema.oneOf
    .filter(
      (e): e is { const: string; title: string } =>
        typeof e === 'object' &&
        e !== null &&
        'const' in e &&
        'title' in e &&
        typeof (e as { const: unknown }).const === 'string',
    )
    .map((e, i) => ({
      id: `${criterionId}-opt-${i}`,
      value: e.title,
    }));
}

// ---------------------------------------------------------------------------
// Composite readers
// ---------------------------------------------------------------------------

export function getCriterion(
  template: RubricTemplateSchema,
  criterionId: string,
): CriterionView | undefined {
  const criterionType = getCriterionType(template, criterionId);
  if (!criterionType) {
    return undefined;
  }

  return {
    id: criterionId,
    criterionType,
    label: getCriterionLabel(template, criterionId),
    description: getCriterionDescription(template, criterionId),
    required: isCriterionRequired(template, criterionId),
    maxPoints: getCriterionMaxPoints(template, criterionId),
    scoreLabels: getCriterionScoreLabels(template, criterionId),
    options: getCriterionOptions(template, criterionId),
  };
}

export function getCriteria(template: RubricTemplateSchema): CriterionView[] {
  const order = getCriterionOrder(template);
  const criteria: CriterionView[] = [];
  for (const id of order) {
    const criterion = getCriterion(template, id);
    if (criterion) {
      criteria.push(criterion);
    }
  }
  return criteria;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns translation keys for validation errors on a criterion.
 * Pass each key through `t()` in the UI layer.
 */
export function getCriterionErrors(criterion: CriterionView): string[] {
  const errors: string[] = [];

  if (!criterion.label.trim()) {
    errors.push('Criterion label is required');
  }

  if (criterion.criterionType === 'dropdown') {
    if (criterion.options.length < 2) {
      errors.push('At least two options are required');
    }
    if (criterion.options.some((o) => !o.value.trim())) {
      errors.push('Options cannot be empty');
    }
  }

  if (criterion.criterionType === 'scored') {
    if (criterion.scoreLabels.some((l) => !l.trim())) {
      errors.push('Score labels cannot be empty');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Immutable mutators — each returns a new template
// ---------------------------------------------------------------------------

export function addCriterion(
  template: RubricTemplateSchema,
  criterionId: string,
  type: RubricCriterionType,
  label: string,
): RubricTemplateSchema {
  const jsonSchema = { ...createCriterionJsonSchema(type), title: label };
  const order = getCriterionOrder(template);

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: jsonSchema,
    },
    'x-field-order': [...order, criterionId],
  };
}

export function removeCriterion(
  template: RubricTemplateSchema,
  criterionId: string,
): RubricTemplateSchema {
  const { [criterionId]: _removed, ...restProps } = template.properties ?? {};
  const order = getCriterionOrder(template).filter((id) => id !== criterionId);
  const required = (template.required ?? []).filter((id) => id !== criterionId);

  return {
    ...template,
    properties: restProps,
    required: required.length > 0 ? required : undefined,
    'x-field-order': order,
  };
}

export function reorderCriteria(
  template: RubricTemplateSchema,
  newOrder: string[],
): RubricTemplateSchema {
  return {
    ...template,
    'x-field-order': newOrder,
  };
}

export function updateCriterionLabel(
  template: RubricTemplateSchema,
  criterionId: string,
  label: string,
): RubricTemplateSchema {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema) {
    return template;
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: { ...schema, title: label },
    },
  };
}

export function updateCriterionDescription(
  template: RubricTemplateSchema,
  criterionId: string,
  description: string | undefined,
): RubricTemplateSchema {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema) {
    return template;
  }

  const updated = { ...schema };
  if (description) {
    updated.description = description;
  } else {
    delete updated.description;
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: updated,
    },
  };
}

export function setCriterionRequired(
  template: RubricTemplateSchema,
  criterionId: string,
  required: boolean,
): RubricTemplateSchema {
  const current = template.required ?? [];
  const filtered = current.filter((id) => id !== criterionId);
  const next = required ? [...filtered, criterionId] : filtered;

  return {
    ...template,
    required: next.length > 0 ? next : undefined,
  };
}

/**
 * Change a criterion's type while preserving its label, description, and
 * required status. The schema is rebuilt from scratch for the new type.
 */
export function changeCriterionType(
  template: RubricTemplateSchema,
  criterionId: string,
  newType: RubricCriterionType,
): RubricTemplateSchema {
  const existing = getCriterionSchema(template, criterionId);
  if (!existing) {
    return template;
  }

  const newSchema: XFormatPropertySchema = {
    ...createCriterionJsonSchema(newType),
    title: existing.title,
  };
  if (existing.description) {
    newSchema.description = existing.description;
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: newSchema,
    },
  };
}

/**
 * Low-level updater for the raw JSON Schema of a criterion.
 * Used for updating score labels, max points, dropdown options, etc.
 */
export function updateCriterionJsonSchema(
  template: RubricTemplateSchema,
  criterionId: string,
  updates: Partial<XFormatPropertySchema>,
): RubricTemplateSchema {
  const existing = getCriterionSchema(template, criterionId);
  if (!existing) {
    return template;
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: { ...existing, ...updates },
    },
  };
}

/**
 * Update the maximum points for a scored criterion.
 * Rebuilds the `oneOf` array to match the new max, preserving existing
 * labels where possible and generating defaults for new levels.
 */
export function updateScoredMaxPoints(
  template: RubricTemplateSchema,
  criterionId: string,
  newMax: number,
): RubricTemplateSchema {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || schema.type !== 'integer') {
    return template;
  }

  const clampedMax = Math.max(2, Math.min(newMax, 10));
  const existingLabels = getCriterionScoreLabels(template, criterionId);

  const oneOf = Array.from({ length: clampedMax }, (_, i) => ({
    const: i + 1,
    title: existingLabels[i] ?? DEFAULT_SCORE_LABELS[i + 1] ?? `${i + 1}`,
  }));

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: {
        ...schema,
        maximum: clampedMax,
        oneOf,
      },
    },
  };
}

/**
 * Update a single score label for a scored criterion.
 */
export function updateScoreLabel(
  template: RubricTemplateSchema,
  criterionId: string,
  scoreIndex: number,
  label: string,
): RubricTemplateSchema {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || schema.type !== 'integer' || !Array.isArray(schema.oneOf)) {
    return template;
  }

  const oneOf = schema.oneOf.map((entry, i) => {
    if (i === scoreIndex && typeof entry === 'object' && entry !== null) {
      return { ...entry, title: label };
    }
    return entry;
  });

  return {
    ...template,
    properties: {
      ...template.properties,
      [criterionId]: { ...schema, oneOf },
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an empty rubric template with no criteria.
 */
export function createEmptyRubricTemplate(): RubricTemplateSchema {
  return {
    type: 'object',
    properties: {},
    'x-field-order': [],
  };
}
