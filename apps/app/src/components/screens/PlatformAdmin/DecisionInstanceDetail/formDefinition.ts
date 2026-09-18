import type {
  CustomFormDefinitionInput,
  CustomFormField,
} from '@op/common/client';

/**
 * The field kinds the builder offers. Each maps onto one branch of
 * `CustomFormModal`'s renderer, so a form authored here always draws a control
 * a participant can answer. Anything the renderer supports but the builder does
 * not (`money`, `location`) is deliberately absent.
 */
export const FORM_FIELD_KINDS = [
  'short-text',
  'long-text',
  'number',
  'checkbox',
  'dropdown',
  'radio',
  'multi-select',
] as const;

export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

/** Kinds that carry a fixed option list. */
export const CHOICE_FIELD_KINDS: readonly FormFieldKind[] = [
  'dropdown',
  'radio',
  'multi-select',
];

export type BuilderField = {
  /** React key and reorder handle. Local to the editor, never persisted. */
  localId: string;
  /** JSON Schema property name — what submissions are keyed by. */
  key: string;
  /**
   * False until the field has been saved once. While false the key tracks the
   * label; afterwards it is frozen, because renaming it would orphan every
   * answer already recorded under the old key.
   */
  isKeyFrozen: boolean;
  kind: FormFieldKind;
  title: string;
  description: string;
  isRequired: boolean;
  options: string[];
};

export type BuilderForm = {
  /** Admin-facing row label (`custom_forms.name`), not shown to participants. */
  name: string;
  /** Heading participants see. */
  title: string;
  description: string;
  phaseId: string;
  fields: BuilderField[];
};

export const createEmptyForm = (phaseId: string): BuilderForm => ({
  name: '',
  title: '',
  description: '',
  phaseId,
  fields: [],
});

export const createEmptyField = (localId: string): BuilderField => ({
  localId,
  key: '',
  isKeyFrozen: false,
  kind: 'short-text',
  title: '',
  description: '',
  isRequired: false,
  options: [],
});

/** Builder state serialized into the stored JSON Schema dialect. */
export const buildDefinition = (
  form: BuilderForm,
): CustomFormDefinitionInput => {
  const properties: Record<string, CustomFormField> = {};

  for (const field of form.fields) {
    properties[field.key] = buildField(field);
  }

  return {
    type: 'object',
    title: form.title.trim(),
    ...(form.description.trim()
      ? { description: form.description.trim() }
      : {}),
    'x-phase': form.phaseId,
    required: form.fields
      .filter((field) => field.isRequired)
      .map((field) => field.key),
    properties,
    'x-field-order': form.fields.map((field) => field.key),
  };
};

/**
 * A stored definition read back into builder state.
 *
 * `unsupportedKeys` names fields this editor cannot represent — a `location` or
 * `money` field, say, written before the builder existed. Saving would drop
 * them, so a caller that gets a non-empty list must refuse to edit the form
 * rather than silently rewriting it.
 */
export const parseDefinition = ({
  schema,
  phaseId,
  name,
}: {
  schema: Record<string, unknown>;
  /** Effective phase resolved by the server (`x-phase` or the initial phase). */
  phaseId: string;
  name: string;
}): { form: BuilderForm; unsupportedKeys: string[] } => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((key): key is string => typeof key === 'string')
      : [],
  );
  const order = Array.isArray(schema['x-field-order'])
    ? schema['x-field-order'].filter(
        (key): key is string => typeof key === 'string',
      )
    : [];

  const keys = [
    ...order.filter((key) => key in properties),
    ...Object.keys(properties).filter((key) => !order.includes(key)),
  ];

  const fields: BuilderField[] = [];
  const unsupportedKeys: string[] = [];

  for (const key of keys) {
    const property = properties[key];
    if (!isRecord(property)) {
      unsupportedKeys.push(key);
      continue;
    }

    const kind = resolveFieldKind(property);
    if (!kind) {
      unsupportedKeys.push(key);
      continue;
    }

    fields.push({
      localId: key,
      key,
      isKeyFrozen: true,
      kind,
      title: typeof property.title === 'string' ? property.title : key,
      description:
        typeof property.description === 'string' ? property.description : '',
      isRequired: required.has(key),
      options: readOptions(property),
    });
  }

  return {
    form: {
      name,
      title: typeof schema.title === 'string' ? schema.title : '',
      description:
        typeof schema.description === 'string' ? schema.description : '',
      phaseId,
      fields,
    },
    unsupportedKeys,
  };
};

/**
 * A JSON Schema property name derived from a label, made unique against
 * `takenKeys`.
 *
 * Falls back to a positional name when the label has no characters a key may
 * start with — a label written entirely in a non-Latin script slugs to nothing,
 * and a form still needs a key for it.
 */
export const deriveFieldKey = ({
  title,
  takenKeys,
  fallbackIndex,
}: {
  title: string;
  takenKeys: readonly string[];
  fallbackIndex: number;
}): string => {
  const base = slugifyKey(title) || `field${fallbackIndex + 1}`;
  const taken = new Set(takenKeys);

  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  while (taken.has(`${base}${suffix}`)) {
    suffix += 1;
  }

  return `${base}${suffix}`;
};

const buildField = (field: BuilderField): CustomFormField => {
  const base = {
    title: field.title.trim(),
    ...(field.description.trim()
      ? { description: field.description.trim() }
      : {}),
  };

  switch (field.kind) {
    case 'checkbox':
      return { ...base, type: 'boolean' };
    case 'number':
      return { ...base, type: 'number' };
    case 'long-text':
      return { ...base, type: 'string', 'x-format': 'long-text' };
    case 'dropdown':
      return {
        ...base,
        type: 'string',
        'x-format': 'dropdown',
        enum: field.options,
      };
    case 'radio':
      return {
        ...base,
        type: 'string',
        'x-format': 'radio',
        enum: field.options,
      };
    case 'multi-select':
      return {
        ...base,
        type: 'array',
        items: { type: 'string', enum: field.options },
        uniqueItems: true,
      };
    case 'short-text':
      return { ...base, type: 'string', 'x-format': 'short-text' };
  }
};

/**
 * Which control `CustomFormModal` would draw for a stored property, or null
 * when it is one this editor cannot round-trip. The branch order mirrors the
 * renderer's, so the kind shown here is the control participants actually get.
 */
const resolveFieldKind = (
  property: Record<string, unknown>,
): FormFieldKind | null => {
  const format = property['x-format'];

  if (property.type === 'boolean') {
    return 'checkbox';
  }

  if (property.type === 'array') {
    return readOptions(property).length > 0 ? 'multi-select' : null;
  }

  const hasOptions = readOptions(property).length > 0;

  if (format === 'radio' && hasOptions) {
    return 'radio';
  }

  if (hasOptions) {
    return 'dropdown';
  }

  // A choice control with nothing to choose from: not editable, not answerable.
  if (format === 'dropdown' || format === 'radio') {
    return null;
  }

  if (property.type === 'number' || property.type === 'integer') {
    return 'number';
  }

  if (property.type !== 'string') {
    return null;
  }

  if (format === 'long-text') {
    return 'long-text';
  }

  // `money` and `location` render controls the builder has no editor for.
  return format === undefined || format === 'short-text' ? 'short-text' : null;
};

const readOptions = (property: Record<string, unknown>): string[] => {
  const source =
    property.type === 'array' && isRecord(property.items)
      ? property.items.enum
      : property.enum;

  return Array.isArray(source)
    ? source.filter((option): option is string => typeof option === 'string')
    : [];
};

const slugifyKey = (title: string): string => {
  const words = title
    .normalize('NFD')
    // Strip combining marks so "é" contributes "e" rather than nothing.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const camel = words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join('');

  // A key must start with a letter, so a label like "2024 budget" loses its
  // leading digits. The word that ends up first is then lower-cased in turn,
  // so dropping them leaves `budget`, not `Budget`.
  const trimmed = camel.replace(/^[^a-zA-Z]+/, '');

  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`.slice(0, 64);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
