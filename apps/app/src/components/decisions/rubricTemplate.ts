/**
 * Rubric Template — JSON Schema utilities.
 *
 * Uses `RubricTemplateSchema` from `@op/common`. Field ordering is stored as a
 * top-level `x-field-order` array. Per-criterion widget selection is driven by
 * `x-format` on each property (consumed by the renderer's rubric field logic).
 *
 * Generic JSON Schema operations are delegated to `templateUtils.ts`.
 * This file adds rubric-specific logic: criterion types, scored config, and
 * type inference from schema shape.
 */
import type {
  RubricTemplateSchema,
  XFormatPropertySchema,
} from '@op/common/client';
import type { JSONSchema7 } from 'json-schema';

import type { TranslationKey } from '@/lib/i18n/routing';

import {
  addProperty,
  getPropertyDescription,
  getPropertyLabel,
  getPropertyOrder,
  getPropertySchema,
  isPropertyRequired,
  isSchemaObject,
  removeProperty,
  reorderProperties,
  setPropertyRequired,
  updateProperty,
  updatePropertyDescription,
  updatePropertyLabel,
} from './templateUtils';

export type { RubricTemplateSchema };

// ---------------------------------------------------------------------------
// Criterion types
// ---------------------------------------------------------------------------

export type RubricCriterionType = 'scored' | 'yes_no' | 'long_text';

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
  /** Labels for each score level (index 0 = score 1, ascending). Scored criteria only. */
  scoreLabels: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_MAX_POINTS = 5;

/**
 * Extract oneOf entries as typed `JSONSchema7[]`, filtering out boolean
 * definitions.
 */
function getOneOfEntries(schema: XFormatPropertySchema): JSONSchema7[] {
  if (!Array.isArray(schema.oneOf)) {
    return [];
  }
  return schema.oneOf.filter(isSchemaObject);
}

// ---------------------------------------------------------------------------
// Criterion type ↔ JSON Schema mapping
// ---------------------------------------------------------------------------

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
        title: '',
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
    if (schema.type === 'integer' && schema.maximum != null) {
      return 'scored';
    }

    if (schema.type === 'string') {
      const values = getOneOfEntries(schema).map((e) => e.const);
      if (
        values.length === 2 &&
        values.includes('yes') &&
        values.includes('no')
      ) {
        return 'yes_no';
      }
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Readers (delegating to shared utils where possible)
// ---------------------------------------------------------------------------

export function getCriterionOrder(template: RubricTemplateSchema): string[] {
  return getPropertyOrder(template);
}

export function getCriterionSchema(
  template: RubricTemplateSchema,
  criterionId: string,
): XFormatPropertySchema | undefined {
  return getPropertySchema(template, criterionId);
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
  return getPropertyLabel(template, criterionId);
}

export function getCriterionDescription(
  template: RubricTemplateSchema,
  criterionId: string,
): string | undefined {
  return getPropertyDescription(template, criterionId);
}

export function isCriterionRequired(
  template: RubricTemplateSchema,
  criterionId: string,
): boolean {
  return isPropertyRequired(template, criterionId);
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
  if (!schema || schema.type !== 'integer') {
    return [];
  }
  return getOneOfEntries(schema)
    .filter(
      (e): e is JSONSchema7 & { const: number; title: string } =>
        typeof e.const === 'number' && typeof e.title === 'string',
    )
    .sort((a, b) => a.const - b.const)
    .map((e) => e.title);
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
export function getCriterionErrors(criterion: CriterionView): TranslationKey[] {
  const errors: TranslationKey[] = [];

  if (!criterion.label.trim()) {
    errors.push('Criterion label is required');
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
  return addProperty(template, criterionId, jsonSchema);
}

export function removeCriterion(
  template: RubricTemplateSchema,
  criterionId: string,
): RubricTemplateSchema {
  return removeProperty(template, criterionId);
}

export function reorderCriteria(
  template: RubricTemplateSchema,
  newOrder: string[],
): RubricTemplateSchema {
  return reorderProperties(template, newOrder);
}

export function updateCriterionLabel(
  template: RubricTemplateSchema,
  criterionId: string,
  label: string,
): RubricTemplateSchema {
  return updatePropertyLabel(template, criterionId, label);
}

export function updateCriterionDescription(
  template: RubricTemplateSchema,
  criterionId: string,
  description: string | undefined,
): RubricTemplateSchema {
  return updatePropertyDescription(template, criterionId, description);
}

export function setCriterionRequired(
  template: RubricTemplateSchema,
  criterionId: string,
  required: boolean,
): RubricTemplateSchema {
  return setPropertyRequired(template, criterionId, required);
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
  return updateProperty(template, criterionId, (existing) => {
    const newSchema: XFormatPropertySchema = {
      ...createCriterionJsonSchema(newType),
      title: existing.title,
    };
    if (existing.description) {
      newSchema.description = existing.description;
    }
    return newSchema;
  });
}

/**
 * Low-level updater for the raw JSON Schema of a criterion.
 * Used for restoring cached scored config, etc.
 */
export function updateCriterionJsonSchema(
  template: RubricTemplateSchema,
  criterionId: string,
  updates: Partial<XFormatPropertySchema>,
): RubricTemplateSchema {
  return updateProperty(template, criterionId, (s) => ({ ...s, ...updates }));
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

  const clampedMax = Math.max(2, newMax);
  const existingLabels = getCriterionScoreLabels(template, criterionId);

  const oneOf = Array.from({ length: clampedMax }, (_, i) => ({
    const: i + 1,
    title: existingLabels[i] ?? '',
  }));

  return updateProperty(template, criterionId, (s) => ({
    ...s,
    maximum: clampedMax,
    oneOf,
  }));
}

/**
 * Update a single score label for a scored criterion.
 * `scoreValue` is the 1-based score (the `.const` in the oneOf entry),
 * not an array index.
 */
export function updateScoreLabel(
  template: RubricTemplateSchema,
  criterionId: string,
  scoreValue: number,
  label: string,
): RubricTemplateSchema {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || schema.type !== 'integer' || !Array.isArray(schema.oneOf)) {
    return template;
  }

  const oneOf = schema.oneOf.map((entry) => {
    if (isSchemaObject(entry) && entry.const === scoreValue) {
      return { ...entry, title: label };
    }
    return entry;
  });

  return updateProperty(template, criterionId, (s) => ({ ...s, oneOf }));
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
