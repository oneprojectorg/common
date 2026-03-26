/**
 * Proposal Template — JSON Schema utilities.
 *
 * Uses `ProposalTemplateSchema` from `@op/common`. Field ordering is stored as a
 * top-level `x-field-order` array. Per-field widget selection is driven by `x-format`
 * on each property (consumed by the renderer's FORMAT_REGISTRY).
 *
 * Generic JSON Schema operations are delegated to `templateUtils.ts`.
 * This file adds proposal-specific logic: field types, options, locked fields,
 * and category management.
 *
 * No separate uiSchema is stored — everything lives in the JSON Schema itself
 * via vendor extensions (`x-*` properties).
 */
import {
  type ProposalTemplateSchema,
  SYSTEM_FIELD_KEYS,
  buildCategorySchema,
  parseSchemaOptions,
  schemaHasOptions,
} from '@op/common/client';

import {
  addProperty,
  getPropertyDescription,
  getPropertyLabel,
  getPropertyOrder,
  isPropertyRequired,
  removeProperty,
  reorderProperties,
  setPropertyRequired,
  updateProperty,
  updatePropertyDescription,
  updatePropertyLabel,
} from './templateUtils';

export type { ProposalTemplateSchema };

export type FieldType = 'short_text' | 'long_text' | 'dropdown';

export const DEFAULT_TEXT_FIELD_MAX_LENGTH: Record<
  Extract<FieldType, 'short_text' | 'long_text'>,
  number
> = {
  short_text: 500,
  long_text: 3000,
};

/**
 * Flat read-only view of a single field, derived from a proposal template.
 * Gives builder/renderer code a friendly object instead of requiring
 * multiple reader calls per field.
 */
export interface FieldView {
  id: string;
  fieldType: FieldType;
  label: string;
  description?: string;
  required: boolean;
  options: { id: string; value: string }[];
  min?: number;
  max?: number;
  isCurrency: boolean;
}

// ---------------------------------------------------------------------------
// x-format ↔ FieldType mapping
// ---------------------------------------------------------------------------

const X_FORMAT_TO_FIELD_TYPE: Record<string, FieldType> = {
  'short-text': 'short_text',
  'long-text': 'long_text',
  dropdown: 'dropdown',
};

// ---------------------------------------------------------------------------
// Field type → JSON Schema creator
// ---------------------------------------------------------------------------

function withXFormat(
  schema: ProposalTemplateSchema,
  xFormat: string,
): ProposalTemplateSchema {
  return { ...schema, 'x-format': xFormat };
}

export function createFieldJsonSchema(type: FieldType): ProposalTemplateSchema {
  switch (type) {
    case 'short_text':
      return withXFormat(
        {
          type: 'string',
          maxLength: DEFAULT_TEXT_FIELD_MAX_LENGTH.short_text,
        },
        'short-text',
      );
    case 'long_text':
      return withXFormat(
        {
          type: 'string',
          maxLength: DEFAULT_TEXT_FIELD_MAX_LENGTH.long_text,
        },
        'long-text',
      );
    case 'dropdown':
      return withXFormat(
        {
          type: 'string',
          oneOf: [
            { const: 'Option 1', title: 'Option 1' },
            { const: 'Option 2', title: 'Option 2' },
          ],
        },
        'dropdown',
      );
  }
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function asSchema(def: unknown): ProposalTemplateSchema | undefined {
  if (typeof def === 'object' && def !== null) {
    return def as ProposalTemplateSchema;
  }
  return undefined;
}

export function getFieldOrder(template: ProposalTemplateSchema): string[] {
  return getPropertyOrder(template);
}

export function getFieldSchema(
  template: ProposalTemplateSchema,
  fieldId: string,
): ProposalTemplateSchema | undefined {
  // Use asSchema to handle legacy schemas where properties may not match
  // the XFormatPropertySchema type exactly.
  const props = template.properties;
  if (!props) {
    return undefined;
  }
  return asSchema(props[fieldId]);
}

export function getFieldType(
  template: ProposalTemplateSchema,
  fieldId: string,
): FieldType | undefined {
  const schema = getFieldSchema(template, fieldId);
  if (!schema) {
    return undefined;
  }
  const xFormat = schema['x-format'] as string | undefined;
  if (!xFormat) {
    return undefined;
  }
  return X_FORMAT_TO_FIELD_TYPE[xFormat];
}

export function getFieldLabel(
  template: ProposalTemplateSchema,
  fieldId: string,
): string {
  return getPropertyLabel(template, fieldId);
}

export function getFieldDescription(
  template: ProposalTemplateSchema,
  fieldId: string,
): string | undefined {
  return getPropertyDescription(template, fieldId);
}

export function isFieldRequired(
  template: ProposalTemplateSchema,
  fieldId: string,
): boolean {
  return isPropertyRequired(template, fieldId);
}

export function getFieldOptions(
  template: ProposalTemplateSchema,
  fieldId: string,
): { id: string; value: string }[] {
  const schema = getFieldSchema(template, fieldId);
  if (!schema) {
    return [];
  }

  // dropdown / category: prefer oneOf, fall back to legacy enum
  if (schema.type === 'string' || Array.isArray(schema.type)) {
    return parseSchemaOptions(schema).map((opt, i) => ({
      id: `${fieldId}-opt-${i}`,
      value: String(opt.value),
    }));
  }

  return [];
}

export { schemaHasOptions };

export function getFieldMin(
  template: ProposalTemplateSchema,
  fieldId: string,
): number | undefined {
  const schema = getFieldSchema(template, fieldId);
  return schema?.minimum;
}

export function getFieldMax(
  template: ProposalTemplateSchema,
  fieldId: string,
): number | undefined {
  const schema = getFieldSchema(template, fieldId);
  return schema?.maximum;
}

export function getFieldIsCurrency(
  template: ProposalTemplateSchema,
  fieldId: string,
): boolean {
  const schema = getFieldSchema(template, fieldId);
  return schema?.['x-format'] === 'money';
}

// ---------------------------------------------------------------------------
// Composite readers
// ---------------------------------------------------------------------------

export function getField(
  template: ProposalTemplateSchema,
  fieldId: string,
): FieldView | undefined {
  const fieldType = getFieldType(template, fieldId);
  if (!fieldType) {
    return undefined;
  }

  return {
    id: fieldId,
    fieldType,
    label: getFieldLabel(template, fieldId),
    description: getFieldDescription(template, fieldId),
    required: isFieldRequired(template, fieldId),
    options: getFieldOptions(template, fieldId),
    min: getFieldMin(template, fieldId),
    max: getFieldMax(template, fieldId),
    isCurrency: getFieldIsCurrency(template, fieldId),
  };
}

export function getFields(template: ProposalTemplateSchema): FieldView[] {
  const order = getFieldOrder(template);
  const fields: FieldView[] = [];
  for (const id of order) {
    const field = getField(template, id);
    if (field) {
      fields.push(field);
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns translation keys for validation errors on a field.
 * Pass each key through `t()` in the UI layer.
 */
export function getFieldErrors(field: FieldView): string[] {
  const errors: string[] = [];

  if (!field.label.trim()) {
    errors.push('Field label is required');
  }

  if (field.fieldType === 'dropdown') {
    if (field.options.length < 2) {
      errors.push('At least two options are required');
    }
    if (field.options.some((o) => !o.value.trim())) {
      errors.push('Options cannot be empty');
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Immutable mutators — each returns a new template
// ---------------------------------------------------------------------------

export function addField(
  template: ProposalTemplateSchema,
  fieldId: string,
  type: FieldType,
  label: string,
): ProposalTemplateSchema {
  const jsonSchema = { ...createFieldJsonSchema(type), title: label };
  return addProperty(template, fieldId, jsonSchema);
}

export function removeField(
  template: ProposalTemplateSchema,
  fieldId: string,
): ProposalTemplateSchema {
  return removeProperty(template, fieldId);
}

export function reorderFields(
  template: ProposalTemplateSchema,
  newOrder: string[],
): ProposalTemplateSchema {
  return reorderProperties(template, newOrder);
}

export function updateFieldLabel(
  template: ProposalTemplateSchema,
  fieldId: string,
  label: string,
): ProposalTemplateSchema {
  return updatePropertyLabel(template, fieldId, label);
}

export function updateFieldDescription(
  template: ProposalTemplateSchema,
  fieldId: string,
  description: string | undefined,
): ProposalTemplateSchema {
  return updatePropertyDescription(template, fieldId, description);
}

export function changeFieldType(
  template: ProposalTemplateSchema,
  fieldId: string,
  newType: FieldType,
): ProposalTemplateSchema {
  return updateProperty(template, fieldId, (existing) => {
    const fresh = createFieldJsonSchema(newType);
    return {
      ...fresh,
      title: existing.title,
      ...(existing.description ? { description: existing.description } : {}),
      // Carry forward dropdown options so switching away and back doesn't lose them.
      // Non-dropdown types ignore `oneOf`; dropdown restores it.
      ...(existing.oneOf ? { oneOf: existing.oneOf } : {}),
    };
  });
}

export function setFieldRequired(
  template: ProposalTemplateSchema,
  fieldId: string,
  required: boolean,
): ProposalTemplateSchema {
  return setPropertyRequired(template, fieldId, required);
}

// ---------------------------------------------------------------------------
// Locked field helpers
// ---------------------------------------------------------------------------

function createLockedFieldSchema(
  xFormat: string,
  title: string,
): ProposalTemplateSchema {
  return withXFormat({ type: 'string', title }, xFormat);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a default template with a locked "proposal title" field
 * and a single "proposal summary" long-text field.
 * Labels must be passed in so they can be translated by the caller.
 */
export function createDefaultTemplate(
  summaryLabel: string,
  titleLabel: string,
): ProposalTemplateSchema {
  const base: ProposalTemplateSchema = {
    type: 'object',
    properties: {
      title: createLockedFieldSchema('short-text', titleLabel),
    },
  };
  const withSummary = addField(base, 'summary', 'long_text', summaryLabel);
  return setFieldRequired(withSummary, 'summary', true);
}

/**
 * Ensures locked system fields (title, category) exist in the
 * template schema and that `x-field-order` and `required` are
 * consistent with the current properties.
 *
 * Call this when hydrating a saved template to handle backward
 * compatibility with templates created before locked fields were
 * stored in the schema.
 *
 * When `categories` are provided, the category field's `oneOf` options
 * are always synced to match the current config — this keeps the
 * template self-contained even when categories change outside the
 * template editor.
 */
export function ensureLockedFields(
  template: ProposalTemplateSchema,
  options: {
    titleLabel: string;
    categoryLabel: string;
    categories?: { label: string }[];
    allowMultipleCategories?: boolean;
    /** When true, the category field is included in the template. Defaults to true. */
    requireCategorySelection?: boolean;
  },
): ProposalTemplateSchema {
  let result = template;

  // Ensure title exists
  if (!getFieldSchema(result, 'title')) {
    result = {
      ...result,
      properties: {
        ...result.properties,
        title: createLockedFieldSchema('short-text', options.titleLabel),
      },
    };
  }

  // Sync category field with categories config
  const hasCategories = (options.categories ?? []).length > 0;
  if (hasCategories) {
    const categoryLabels = (options.categories ?? []).map((c) => c.label);
    const existing = getFieldSchema(result, 'category');
    const categorySchema = buildCategorySchema(categoryLabels, {
      allowMultipleCategories: options.allowMultipleCategories,
      requireCategorySelection: options.requireCategorySelection,
      existing: existing ?? {},
    });
    // Preserve existing title or fall back to the configured label
    categorySchema.title =
      (existing?.title as string | undefined) ?? options.categoryLabel;

    result = {
      ...result,
      properties: {
        ...result.properties,
        category: categorySchema,
      },
    };
  } else if (getFieldSchema(result, 'category')) {
    const { category: _, ...restProps } = result.properties ?? {};
    result = { ...result, properties: restProps };
  }

  // --- Ensure x-field-order contains every property key -------------------
  // System fields always lead in canonical order (title, category, budget).
  // Non-system fields preserve their existing relative order. Any property
  // key not yet in the order is appended at the end.
  const properties = result.properties ?? {};
  const order = getFieldOrder(result);

  const systemKeys = Array.from(SYSTEM_FIELD_KEYS);
  const systemSet = SYSTEM_FIELD_KEYS;

  // System fields present in properties, in canonical order
  const prefix = systemKeys.filter((k) => properties[k]);

  // Non-system fields: keep existing order, strip stale/system keys,
  // then append any property keys not yet present
  const rest = order.filter((k) => !systemSet.has(k) && properties[k]);
  const restSet = new Set(rest);
  for (const key of Object.keys(properties)) {
    if (!systemSet.has(key) && !restSet.has(key)) {
      rest.push(key);
    }
  }

  result = {
    ...result,
    'x-field-order': [...prefix, ...rest],
  };

  // --- Ensure required includes title; category only when requireCategorySelection is on ---
  const currentRequired = new Set(result.required ?? []);
  currentRequired.add('title');
  if (properties.category && options.requireCategorySelection) {
    currentRequired.add('category');
  } else {
    currentRequired.delete('category');
  }
  result = {
    ...result,
    required: [...currentRequired],
  };

  return result;
}
