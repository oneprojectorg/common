/**
 * Proposal Template — JSON Schema + UI Schema utilities.
 *
 * A ProposalTemplate is `JSONSchema7 & { ui?: UiSchema }`, the same shape used
 * by PhaseDefinition.settings elsewhere in this codebase.  The `ui` property
 * carries RJSF uiSchema data plus builder-only metadata (field type, locked
 * flag, enum IDs for sortable options).
 */
import type { StrictRJSFSchema, UiSchema } from '@rjsf/utils';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type ProposalTemplate = StrictRJSFSchema & { ui?: UiSchema };

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
  locked: boolean;
  required: boolean;
  options: { id: string; value: string }[];
  min?: number;
  max?: number;
  isCurrency: boolean;
}

// ---------------------------------------------------------------------------
// Field type → JSON Schema / UI entry creators
// ---------------------------------------------------------------------------

export function createFieldJsonSchema(type: FieldType): StrictRJSFSchema {
  switch (type) {
    case 'short_text':
      return { type: 'string' };
    case 'long_text':
      return { type: 'string' };
    case 'multiple_choice':
      return {
        type: 'array',
        items: { type: 'string', enum: [] },
        uniqueItems: true,
      };
    case 'dropdown':
      return { type: 'string', enum: [] };
    case 'yes_no':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'number':
      return { type: 'number' };
  }
}

export function createFieldUiEntry(type: FieldType): UiSchema {
  switch (type) {
    case 'short_text':
      return { 'ui:widget': 'text', 'ui:fieldType': 'short_text' };
    case 'long_text':
      return { 'ui:widget': 'textarea', 'ui:fieldType': 'long_text' };
    case 'multiple_choice':
      return {
        'ui:widget': 'checkboxes',
        'ui:fieldType': 'multiple_choice',
      };
    case 'dropdown':
      return { 'ui:widget': 'select', 'ui:fieldType': 'dropdown' };
    case 'yes_no':
      return { 'ui:widget': 'radio', 'ui:fieldType': 'yes_no' };
    case 'date':
      return { 'ui:widget': 'date', 'ui:fieldType': 'date' };
    case 'number':
      return { 'ui:widget': 'updown', 'ui:fieldType': 'number' };
  }
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

function asSchema(def: unknown): StrictRJSFSchema | undefined {
  if (typeof def === 'object' && def !== null) {
    return def as StrictRJSFSchema;
  }
  return undefined;
}

export function getFieldOrder(template: ProposalTemplate): string[] {
  return (template.ui?.['ui:order'] as string[] | undefined) ?? [];
}

export function getFieldSchema(
  template: ProposalTemplate,
  fieldId: string,
): StrictRJSFSchema | undefined {
  const props = template.properties;
  if (!props) {
    return undefined;
  }
  return asSchema(props[fieldId]);
}

export function getFieldUi(
  template: ProposalTemplate,
  fieldId: string,
): UiSchema {
  return (template.ui?.[fieldId] as UiSchema | undefined) ?? {};
}

export function getFieldType(
  template: ProposalTemplate,
  fieldId: string,
): FieldType | undefined {
  const ui = getFieldUi(template, fieldId);
  return ui['ui:fieldType'] as FieldType | undefined;
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

export function isFieldLocked(
  template: ProposalTemplate,
  fieldId: string,
): boolean {
  const ui = getFieldUi(template, fieldId);
  return ui['ui:locked'] === true;
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
  const ui = getFieldUi(template, fieldId);
  if (!schema) {
    return [];
  }

  const enumIds = (ui['ui:enumIds'] as string[] | undefined) ?? [];

  // dropdown: enum is on schema directly
  if (schema.type === 'string' && Array.isArray(schema.enum)) {
    return schema.enum.map((val, i) => ({
      id: enumIds[i] ?? crypto.randomUUID(),
      value: String(val ?? ''),
    }));
  }

  // multiple_choice: enum is on items
  if (schema.type === 'array') {
    const items = asSchema(schema.items);
    if (items && Array.isArray(items.enum)) {
      return items.enum.map((val, i) => ({
        id: enumIds[i] ?? crypto.randomUUID(),
        value: String(val ?? ''),
      }));
    }
  }

  return [];
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
  const ui = getFieldUi(template, fieldId);
  return (
    (ui['ui:options'] as Record<string, unknown> | undefined)?.isCurrency ===
    true
  );
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
    locked: isFieldLocked(template, fieldId),
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
// Immutable mutators — each returns a new ProposalTemplate
// ---------------------------------------------------------------------------

export function addField(
  template: ProposalTemplate,
  fieldId: string,
  type: FieldType,
  label: string,
): ProposalTemplate {
  const jsonSchema = { ...createFieldJsonSchema(type), title: label };
  const uiEntry = createFieldUiEntry(type);
  const order = getFieldOrder(template);

  return {
    ...template,
    properties: {
      ...template.properties,
      [fieldId]: jsonSchema,
    },
    ui: {
      ...template.ui,
      'ui:order': [...order, fieldId],
      [fieldId]: uiEntry,
    },
  };
}

export function removeField(
  template: ProposalTemplate,
  fieldId: string,
): ProposalTemplate {
  const { [fieldId]: _removed, ...restProps } = template.properties ?? {};
  const order = getFieldOrder(template).filter((id) => id !== fieldId);
  const required = (template.required ?? []).filter((id) => id !== fieldId);

  // Remove from ui
  const { [fieldId]: _removedUi, ...restUi } = template.ui ?? {};

  return {
    ...template,
    properties: restProps,
    required: required.length > 0 ? required : undefined,
    ui: {
      ...restUi,
      'ui:order': order,
    },
  };
}

export function reorderFields(
  template: ProposalTemplate,
  newOrder: string[],
): ProposalTemplate {
  // Preserve locked fields at the start in their original order
  const currentOrder = getFieldOrder(template);
  const lockedIds = currentOrder.filter((id) => isFieldLocked(template, id));
  const reordered = [
    ...lockedIds,
    ...newOrder.filter((id) => !lockedIds.includes(id)),
  ];

  return {
    ...template,
    ui: {
      ...template.ui,
      'ui:order': reordered,
    },
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

export function updateFieldOptions(
  template: ProposalTemplate,
  fieldId: string,
  options: { id: string; value: string }[],
): ProposalTemplate {
  const schema = getFieldSchema(template, fieldId);
  if (!schema) {
    return template;
  }

  const enumValues = options.map((o) => o.value);
  const enumIds = options.map((o) => o.id);
  const ui = getFieldUi(template, fieldId);

  let updatedSchema: StrictRJSFSchema;
  if (schema.type === 'array') {
    // multiple_choice
    const items = asSchema(schema.items);
    updatedSchema = {
      ...schema,
      items: { ...items, enum: enumValues },
    };
  } else {
    // dropdown
    updatedSchema = { ...schema, enum: enumValues };
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [fieldId]: updatedSchema,
    },
    ui: {
      ...template.ui,
      [fieldId]: { ...ui, 'ui:enumIds': enumIds },
    },
  };
}

export function updateFieldNumberConfig(
  template: ProposalTemplate,
  fieldId: string,
  config: { min?: number; max?: number; isCurrency?: boolean },
): ProposalTemplate {
  const schema = getFieldSchema(template, fieldId);
  if (!schema) {
    return template;
  }

  const updatedSchema = { ...schema };
  if (config.min !== undefined) {
    updatedSchema.minimum = config.min;
  } else {
    delete updatedSchema.minimum;
  }
  if (config.max !== undefined) {
    updatedSchema.maximum = config.max;
  } else {
    delete updatedSchema.maximum;
  }

  const ui = getFieldUi(template, fieldId);
  const updatedUi = { ...ui };
  if (config.isCurrency !== undefined) {
    updatedUi['ui:options'] = {
      ...(updatedUi['ui:options'] as Record<string, unknown> | undefined),
      isCurrency: config.isCurrency,
    };
  }

  return {
    ...template,
    properties: {
      ...template.properties,
      [fieldId]: updatedSchema,
    },
    ui: {
      ...template.ui,
      [fieldId]: updatedUi,
    },
  };
}

// ---------------------------------------------------------------------------
// Default template factory
// ---------------------------------------------------------------------------

export function createDefaultTemplate(labels: {
  proposalTitle: string;
  category: string;
  proposalSummary: string;
}): ProposalTemplate {
  return {
    type: 'object',
    required: ['proposal-title', 'category'],
    properties: {
      'proposal-title': {
        type: 'string',
        title: labels.proposalTitle,
      },
      category: {
        type: 'string',
        enum: [],
        title: labels.category,
      },
      'proposal-summary': {
        type: 'string',
        title: labels.proposalSummary,
      },
    },
    ui: {
      'ui:order': ['proposal-title', 'category', 'proposal-summary'],
      'proposal-title': {
        'ui:widget': 'text',
        'ui:fieldType': 'short_text',
        'ui:locked': true,
      },
      category: {
        'ui:widget': 'select',
        'ui:fieldType': 'dropdown',
        'ui:locked': true,
      },
      'proposal-summary': {
        'ui:widget': 'textarea',
        'ui:fieldType': 'long_text',
      },
    },
  };
}
