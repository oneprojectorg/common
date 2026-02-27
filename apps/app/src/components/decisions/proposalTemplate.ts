/**
 * Proposal Template — JSON Schema utilities.
 *
 * Uses `ProposalTemplateSchema` from `@op/common`. Field ordering is stored as a
 * top-level `x-field-order` array. Per-field widget selection is driven by `x-format`
 * on each property (consumed by the renderer's FORMAT_REGISTRY).
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

export type { ProposalTemplateSchema };

export type FieldType = 'short_text' | 'long_text' | 'dropdown';

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
      return withXFormat({ type: 'string' }, 'short-text');
    case 'long_text':
      return withXFormat({ type: 'string' }, 'long-text');
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
  return (template['x-field-order'] as string[] | undefined) ?? [];
}

export function getFieldSchema(
  template: ProposalTemplateSchema,
  fieldId: string,
): ProposalTemplateSchema | undefined {
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
  const schema = getFieldSchema(template, fieldId);
  return (schema?.title as string | undefined) ?? '';
}

export function getFieldDescription(
  template: ProposalTemplateSchema,
  fieldId: string,
): string | undefined {
  const schema = getFieldSchema(template, fieldId);
  return schema?.description;
}

export function isFieldRequired(
  template: ProposalTemplateSchema,
  fieldId: string,
): boolean {
  const required = template.required;
  if (!Array.isArray(required)) {
    return false;
  }
  return required.includes(fieldId);
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
      value: opt.value,
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
  const order = getFieldOrder(template);

  return {
    ...template,
    properties: {
      ...template.properties,
      [fieldId]: jsonSchema,
    },
    'x-field-order': [...order, fieldId],
  };
}

export function removeField(
  template: ProposalTemplateSchema,
  fieldId: string,
): ProposalTemplateSchema {
  const { [fieldId]: _removed, ...restProps } = template.properties ?? {};
  const order = getFieldOrder(template).filter((id) => id !== fieldId);
  const required = (template.required ?? []).filter((id) => id !== fieldId);

  return {
    ...template,
    properties: restProps,
    required: required.length > 0 ? required : undefined,
    'x-field-order': order,
  };
}

export function reorderFields(
  template: ProposalTemplateSchema,
  newOrder: string[],
): ProposalTemplateSchema {
  return {
    ...template,
    'x-field-order': newOrder,
  };
}

export function updateFieldLabel(
  template: ProposalTemplateSchema,
  fieldId: string,
  label: string,
): ProposalTemplateSchema {
  const schema = getFieldSchema(template, fieldId);
  if (!schema) {
    return template;
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [fieldId]: { ...schema, title: label },
    },
  };
}

export function updateFieldDescription(
  template: ProposalTemplateSchema,
  fieldId: string,
  description: string | undefined,
): ProposalTemplateSchema {
  const schema = getFieldSchema(template, fieldId);
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
      [fieldId]: updated,
    },
  };
}

export function setFieldRequired(
  template: ProposalTemplateSchema,
  fieldId: string,
  required: boolean,
): ProposalTemplateSchema {
  const current = template.required ?? [];
  const filtered = current.filter((id) => id !== fieldId);
  const next = required ? [...filtered, fieldId] : filtered;

  return {
    ...template,
    required: next.length > 0 ? next : undefined,
  };
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
    const categorySchema = buildCategorySchema(categoryLabels, existing ?? {});
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
