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
import {
  OVERALL_RECOMMENDATION_KEY,
  RECOMMENDATION_OPTION,
  isOverallRecommendationField,
  isYesNoCriterionSchema,
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

export type RubricCriterionType =
  | 'scored'
  | 'yes_no'
  | 'single_select'
  | 'long_text';

/**
 * Stored encoding of a yes/no criterion's answer. These literals define the
 * criterion's schema options, drive `inferCriterionType`, and are what the
 * review form reads and writes — stored answers go stale if they change.
 */
export const YES_NO_VALUES = { yes: 'yes', no: 'no' } as const;

/** A single admin-defined option on a single-select criterion. */
export interface SelectOption {
  /** Stable generated id stored as the answer value. */
  value: string;
  /** Admin-editable display label. */
  title: string;
  /**
   * Optional per-option explanation (e.g. what "Maybe" means for this
   * criterion). Carried in the schema but not yet editable in the builder.
   */
  description?: string;
}

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
  /** Admin-defined options. Single-select criteria only (empty for other types). */
  options: SelectOption[];
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

/**
 * Extract `oneOf` option entries with string consts and string titles
 * (the single-select option encoding).
 */
function getSelectOptionEntries(schema: XFormatPropertySchema): SelectOption[] {
  return getOneOfEntries(schema)
    .filter(
      (e): e is JSONSchema7 & { const: string; title: string } =>
        typeof e.const === 'string' && typeof e.title === 'string',
    )
    .map((e) => ({
      value: e.const,
      title: e.title,
      ...(typeof e.description === 'string'
        ? { description: e.description }
        : {}),
    }));
}

// ---------------------------------------------------------------------------
// Criterion type ↔ JSON Schema mapping
// ---------------------------------------------------------------------------

/**
 * Create the JSON Schema for a given criterion type.
 *
 * `selectOptionLabels` seeds the options of a `single_select` criterion
 * (one option per label, each with a fresh id); ignored for other types.
 * Callers with i18n access pass translated labels (e.g. Yes/Maybe/No).
 */
export function createCriterionJsonSchema(
  type: RubricCriterionType,
  selectOptionLabels?: string[],
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
          { const: YES_NO_VALUES.yes, title: 'Yes' },
          { const: YES_NO_VALUES.no, title: 'No' },
        ],
      };
    case 'single_select': {
      const labels = selectOptionLabels ?? ['', ''];
      return {
        type: 'string',
        'x-format': 'dropdown',
        oneOf: labels.map((title) => ({
          const: crypto.randomUUID().slice(0, 8),
          title,
        })),
      };
    }
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
      // Shared with the translation layer, which has to know that a yes/no
      // criterion's option labels are ours and not the admin's.
      if (isYesNoCriterionSchema(schema)) {
        return 'yes_no';
      }

      const values = getOneOfEntries(schema).map((e) => e.const);

      // Any other string dropdown with options is a single-select
      // "multiple choice" criterion. Note the overall recommendation field
      // matches this shape too — callers exclude it by key before relying
      // on the inferred type.
      if (values.some((value) => typeof value === 'string')) {
        return 'single_select';
      }
    }
  }

  return undefined;
}

/**
 * Fill unanswered yes/no criteria with 'no'. The switch has no unset state —
 * it already reads as "No" before the reviewer touches it — so a required
 * criterion would otherwise demand a Yes→No round trip just to record the
 * value the UI was showing all along.
 *
 * Optional criteria are seeded too, on purpose: the switch shows "No" either
 * way, so "skipped" is not a state the reviewer can see or express.
 */
export function withYesNoDefaults(
  template: RubricTemplateSchema,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const seeded = { ...answers };
  for (const [key, schema] of Object.entries(template.properties ?? {})) {
    if (seeded[key] === undefined && inferCriterionType(schema) === 'yes_no') {
      seeded[key] = YES_NO_VALUES.no;
    }
  }
  return seeded;
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

/**
 * Options of a single-select criterion, in stored order.
 * Empty for other criterion types.
 */
export function getCriterionOptions(
  template: RubricTemplateSchema,
  criterionId: string,
): SelectOption[] {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || inferCriterionType(schema) !== 'single_select') {
    return [];
  }
  return getSelectOptionEntries(schema);
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
    if (isOverallRecommendationField(id)) continue;
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

  if (criterion.criterionType === 'single_select') {
    if (criterion.options.length < 2) {
      errors.push('At least two options are required');
    }
    if (criterion.options.some((option) => !option.title.trim())) {
      errors.push('Options cannot be empty');
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
  selectOptionLabels?: string[],
): RubricTemplateSchema {
  const jsonSchema = {
    ...createCriterionJsonSchema(type, selectOptionLabels),
    title: label,
  };
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
  selectOptionLabels?: string[],
): RubricTemplateSchema {
  return updateProperty(template, criterionId, (existing) => {
    const newSchema: XFormatPropertySchema = {
      ...createCriterionJsonSchema(newType, selectOptionLabels),
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

/**
 * Replace the full option list of a single-select criterion — labels, order,
 * additions, and removals in one call (mirrors the proposal template's
 * dropdown options editor). Callers pass existing option ids through
 * unchanged so stored answers keep matching; only relabels/reorders/removals
 * affect the schema. No-op when the criterion isn't a single-select.
 */
export function setSelectOptions(
  template: RubricTemplateSchema,
  criterionId: string,
  options: SelectOption[],
): RubricTemplateSchema {
  const schema = getCriterionSchema(template, criterionId);
  if (!schema || inferCriterionType(schema) !== 'single_select') {
    return template;
  }

  const oneOf = options.map((option) => ({
    const: option.value,
    title: option.title,
    ...(option.description !== undefined
      ? { description: option.description }
      : {}),
  }));

  return updateProperty(template, criterionId, (s) => ({ ...s, oneOf }));
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Translated rubric copy keyed by criterion id (and, for options, by option
 * value) — the shape `parseTranslatedMeta` produces from a `translateRubric`
 * response.
 */
export interface RubricTranslatedMeta {
  fieldTitles: Record<string, string>;
  fieldDescriptions: Record<string, string>;
  optionLabels: Record<string, Record<string, string>>;
  optionDescriptions: Record<string, Record<string, string>>;
}

/**
 * Returns the template with every criterion prompt, description and option
 * label replaced by its translation, leaving anything untranslated as-authored.
 *
 * Applied at the template level rather than per render site so one call covers
 * the review form, the submitted-review view and the score card — and so only
 * display copy moves: `const` option values, `x-format`, bounds and the
 * `required` list are untouched, which keeps stored answers matching and
 * validation running against the same values either way.
 */
export function translateRubricTemplate(
  template: RubricTemplateSchema,
  meta: RubricTranslatedMeta | null,
): RubricTemplateSchema {
  if (!meta) {
    return template;
  }

  let translated = template;

  for (const criterionId of Object.keys(template.properties ?? {})) {
    const title = meta.fieldTitles[criterionId];
    const description = meta.fieldDescriptions[criterionId];
    const optionLabels = meta.optionLabels[criterionId];
    const optionDescriptions = meta.optionDescriptions[criterionId];

    if (!title && !description && !optionLabels && !optionDescriptions) {
      continue;
    }

    const hasOptionCopy = !!(optionLabels || optionDescriptions);

    translated = updateProperty(translated, criterionId, (schema) => {
      const translateOptions = (entries: (JSONSchema7 | boolean)[]) =>
        entries.map((entry) =>
          translateOptionEntry(entry, optionLabels, optionDescriptions),
        );

      // Options can also hang off `items` (an array-valued field). Rewritten
      // here as well so everything `getTranslatableRubricCopy` collects can be
      // put back — a translation the sender paid for and the renderer dropped
      // would read as authored copy for no visible reason.
      const itemSchema =
        schema.items !== undefined &&
        !Array.isArray(schema.items) &&
        isSchemaObject(schema.items)
          ? schema.items
          : undefined;

      return {
        ...schema,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(hasOptionCopy && Array.isArray(schema.oneOf)
          ? { oneOf: translateOptions(schema.oneOf) }
          : {}),
        ...(hasOptionCopy && Array.isArray(itemSchema?.oneOf)
          ? {
              items: {
                ...itemSchema,
                oneOf: translateOptions(itemSchema.oneOf),
              },
            }
          : {}),
      };
    });
  }

  return translated;
}

/** Swaps one `oneOf` option's label and description; other entry shapes pass through. */
function translateOptionEntry(
  entry: JSONSchema7 | boolean,
  labels: Record<string, string> | undefined,
  descriptions: Record<string, string> | undefined,
): JSONSchema7 | boolean {
  if (!isSchemaObject(entry) || entry.const == null) {
    return entry;
  }

  const optionValue = String(entry.const);
  const title = labels?.[optionValue];
  const description = descriptions?.[optionValue];

  if (!title && !description) {
    return entry;
  }

  return {
    ...entry,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
}

// ---------------------------------------------------------------------------
// Overall Recommendation
// ---------------------------------------------------------------------------

export { OVERALL_RECOMMENDATION_KEY };

export function hasOverallRecommendation(
  template: RubricTemplateSchema,
): boolean {
  return OVERALL_RECOMMENDATION_KEY in (template.properties ?? {});
}

/**
 * Adds the criterion, with English copy that is never rendered: the prompt and
 * the option labels are ours, so every screen reads them from the dictionary
 * through `useRecommendationLabels` and the translation pipeline skips the field
 * (see `getTranslatableRubricCopy`). The titles below are kept so the schema is
 * a valid, self-describing dropdown; don't localize them at authoring time, or
 * the admin's locale is frozen into the rubric every reviewer then reads.
 */
export function enableOverallRecommendation(
  template: RubricTemplateSchema,
): RubricTemplateSchema {
  if (hasOverallRecommendation(template)) {
    return template;
  }
  const schema: XFormatPropertySchema = {
    type: 'string',
    title: 'Overall Recommendation',
    'x-format': 'dropdown',
    oneOf: Object.values(RECOMMENDATION_OPTION).map(({ value, label }) => ({
      const: value,
      title: label,
    })),
  };
  let updated = addProperty(template, OVERALL_RECOMMENDATION_KEY, schema);
  updated = setPropertyRequired(updated, OVERALL_RECOMMENDATION_KEY, true);
  return updated;
}

export function disableOverallRecommendation(
  template: RubricTemplateSchema,
): RubricTemplateSchema {
  return removeProperty(template, OVERALL_RECOMMENDATION_KEY);
}

/**
 * If the overall recommendation criterion exists, move it to the end of
 * `x-field-order`. No-op when absent.
 */
export function ensureOverallRecommendationLast(
  template: RubricTemplateSchema,
): RubricTemplateSchema {
  const order = getPropertyOrder(template);
  if (!order.includes(OVERALL_RECOMMENDATION_KEY)) {
    return template;
  }
  const withoutRec = order.filter((id) => id !== OVERALL_RECOMMENDATION_KEY);
  return reorderProperties(template, [
    ...withoutRec,
    OVERALL_RECOMMENDATION_KEY,
  ]);
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
