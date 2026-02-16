/**
 * Proposal Template — JSON Schema utilities.
 *
 * A ProposalTemplate is a plain `RJSFSchema`. Field ordering is stored as a
 * top-level `x-field-order` array. Per-field widget selection is driven by `x-format`
 * on each property (consumed by the renderer's FORMAT_REGISTRY).
 *
 * No separate uiSchema is stored — everything lives in the JSON Schema itself
 * via vendor extensions (`x-*` properties).
 */
import type { RJSFSchema } from '@rjsf/utils';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type ProposalTemplate = RJSFSchema;

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'dropdown'
  | 'yes_no'
  | 'date'
  | 'number';

/**
 * Flat read-only view of a single field, derived from a ProposalTemplate.
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
  'multiple-choice': 'multiple_choice',
  dropdown: 'dropdown',
  'yes-no': 'yes_no',
  date: 'date',
  number: 'number',
  money: 'number',
};

// ---------------------------------------------------------------------------
// Field type → JSON Schema creator
// ---------------------------------------------------------------------------

function withXFormat(schema: RJSFSchema, xFormat: string): RJSFSchema {
  return { ...schema, 'x-format': xFormat };
}

export function createFieldJsonSchema(type: FieldType): RJSFSchema {
  switch (type) {
    case 'short_text':
      return withXFormat({ type: 'string' }, 'short-text');
    case 'long_text':
      return withXFormat({ type: 'string' }, 'long-text');
    case 'multiple_choice':
      return withXFormat(
        {
          type: 'array',
          items: { type: 'string', enum: [] },
          uniqueItems: true,
        },
        'multiple-choice',
      );
    case 'dropdown':
      return withXFormat({ type: 'string', oneOf: [] }, 'dropdown');
    case 'yes_no':
      return withXFormat({ type: 'boolean' }, 'yes-no');
    case 'date':
      return withXFormat({ type: 'string', format: 'date' }, 'date');
    case 'number':
      return withXFormat({ type: 'number' }, 'number');
  }
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function asSchema(def: unknown): RJSFSchema | undefined {
  if (typeof def === 'object' && def !== null) {
    return def as RJSFSchema;
  }
  return undefined;
}

export function getFieldOrder(template: ProposalTemplate): string[] {
  return (template['x-field-order'] as string[] | undefined) ?? [];
}

export function getFieldSchema(
  template: ProposalTemplate,
  fieldId: string,
): RJSFSchema | undefined {
  const props = template.properties;
  if (!props) {
    return undefined;
  }
  return asSchema(props[fieldId]);
}

export function getFieldType(
  template: ProposalTemplate,
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
  template: ProposalTemplate,
  fieldId: string,
): string {
  const schema = getFieldSchema(template, fieldId);
  return (schema?.title as string | undefined) ?? '';
}

export function getFieldDescription(
  template: ProposalTemplate,
  fieldId: string,
): string | undefined {
  const schema = getFieldSchema(template, fieldId);
  return schema?.description;
}

export function isFieldRequired(
  template: ProposalTemplate,
  fieldId: string,
): boolean {
  const required = template.required;
  if (!Array.isArray(required)) {
    return false;
  }
  return required.includes(fieldId);
}

export function getFieldOptions(
  template: ProposalTemplate,
  fieldId: string,
): { id: string; value: string }[] {
  const schema = getFieldSchema(template, fieldId);
  if (!schema) {
    return [];
  }

  // dropdown / category: prefer oneOf, fall back to legacy enum
  if (schema.type === 'string' || Array.isArray(schema.type)) {
    if (Array.isArray(schema.oneOf)) {
      return schema.oneOf
        .filter(
          (entry): entry is { const: string; title: string } =>
            typeof entry === 'object' &&
            entry !== null &&
            'const' in entry &&
            typeof (entry as Record<string, unknown>).const === 'string',
        )
        .map((entry, i) => ({
          id: `${fieldId}-opt-${i}`,
          value: entry.const,
        }));
    }

    if (Array.isArray(schema.enum)) {
      return schema.enum
        .filter((val): val is string => typeof val === 'string')
        .map((val, i) => ({
          id: `${fieldId}-opt-${i}`,
          value: val,
        }));
    }
  }

  // multiple_choice: enum is on items
  if (schema.type === 'array') {
    const items = asSchema(schema.items);
    if (items && Array.isArray(items.enum)) {
      return items.enum.map((val, i) => ({
        id: `${fieldId}-opt-${i}`,
        value: String(val ?? ''),
      }));
    }
  }

  return [];
}

/**
 * Check whether a JSON Schema property has selectable options.
 * Returns `true` when the schema contains a non-empty `oneOf` array
 * (canonical format) **or** a non-empty `enum` array (legacy format).
 */
export function schemaHasOptions(schema: RJSFSchema | undefined): boolean {
  if (!schema) {
    return false;
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return true;
  }
  if (
    Array.isArray(schema.enum) &&
    schema.enum.filter((v) => v != null).length > 0
  ) {
    return true;
  }
  return false;
}

export function getFieldMin(
  template: ProposalTemplate,
  fieldId: string,
): number | undefined {
  const schema = getFieldSchema(template, fieldId);
  return schema?.minimum;
}

export function getFieldMax(
  template: ProposalTemplate,
  fieldId: string,
): number | undefined {
  const schema = getFieldSchema(template, fieldId);
  return schema?.maximum;
}

export function getFieldIsCurrency(
  template: ProposalTemplate,
  fieldId: string,
): boolean {
  const schema = getFieldSchema(template, fieldId);
  return schema?.['x-format'] === 'money';
}

// ---------------------------------------------------------------------------
// Composite readers
// ---------------------------------------------------------------------------

export function getField(
  template: ProposalTemplate,
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

export function getFields(template: ProposalTemplate): FieldView[] {
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

  if (field.fieldType === 'dropdown' || field.fieldType === 'multiple_choice') {
    if (field.options.length < 2) {
      errors.push('At least two options are required');
    }
    if (field.options.some((o) => !o.value.trim())) {
      errors.push('Options cannot be empty');
    }
  }

  if (
    field.fieldType === 'number' &&
    field.min !== undefined &&
    field.max !== undefined &&
    field.min > field.max
  ) {
    errors.push('Minimum must be less than or equal to maximum');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Immutable mutators — each returns a new ProposalTemplate
// ---------------------------------------------------------------------------

export function addField(
  template: ProposalTemplate,
  fieldId: string,
  type: FieldType,
  label: string,
): ProposalTemplate {
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
  template: ProposalTemplate,
  fieldId: string,
): ProposalTemplate {
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
  template: ProposalTemplate,
  newOrder: string[],
): ProposalTemplate {
  return {
    ...template,
    'x-field-order': newOrder,
  };
}

export function updateFieldLabel(
  template: ProposalTemplate,
  fieldId: string,
  label: string,
): ProposalTemplate {
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
  template: ProposalTemplate,
  fieldId: string,
  description: string | undefined,
): ProposalTemplate {
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
  template: ProposalTemplate,
  fieldId: string,
  required: boolean,
): ProposalTemplate {
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

function createLockedFieldSchema(xFormat: string, title: string): RJSFSchema {
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
): ProposalTemplate {
  const base: ProposalTemplate = {
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
 * template schema. Call this when hydrating a saved template to handle
 * backward compatibility with templates created before locked fields
 * were stored in the schema.
 *
 * When `categories` are provided, the category field's `oneOf` options
 * are always synced to match the current config — this keeps the
 * template self-contained even when categories change outside the
 * template editor.
 */
export function ensureLockedFields(
  template: ProposalTemplate,
  options: {
    titleLabel: string;
    categoryLabel: string;
    hasCategories: boolean;
    categories?: { label: string }[];
  },
): ProposalTemplate {
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
  if (options.hasCategories) {
    const oneOf = (options.categories ?? []).map((c) => ({
      const: c.label,
      title: c.label,
    }));

    const existing = getFieldSchema(result, 'category');
    const { enum: _legacyEnum, ...existingRest } = (existing ?? {}) as Record<
      string,
      unknown
    >;

    result = {
      ...result,
      properties: {
        ...result.properties,
        category: {
          ...existingRest,
          type: 'string',
          title:
            (existing?.title as string | undefined) ?? options.categoryLabel,
          'x-format': 'dropdown' as const,
          oneOf,
        } as RJSFSchema,
      },
    };
  } else if (getFieldSchema(result, 'category')) {
    const { category: _, ...restProps } = result.properties ?? {};
    result = { ...result, properties: restProps };
  }

  return result;
}
