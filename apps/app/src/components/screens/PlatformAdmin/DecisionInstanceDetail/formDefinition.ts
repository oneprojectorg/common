import type {
  CustomFormDefinitionInput,
  CustomFormField,
  XFormatPropertySchema,
} from '@op/common/client';
import {
  CUSTOM_FORM_MAX_FIELDS,
  customFormDefinitionInputSchema,
} from '@op/common/client';

/**
 * What an author may type into each box, in characters. Taken from the
 * proposal template builder, the editor this one sits beside; the service
 * schema's far larger caps stay the outer bound.
 */
export const FORM_CHARACTER_LIMITS = {
  name: 50,
  title: 50,
  description: 250,
  fieldTitle: 50,
  fieldDescription: 250,
  gridRowTitle: 100,
} as const;

/** One branch each of `CustomFormModal`'s renderer. `money` and `location` are
 *  deliberately absent — the builder has no editor for them. */
export const FORM_FIELD_KINDS = [
  'short-text',
  'long-text',
  'number',
  'checkbox',
  'dropdown',
  'radio',
  'multi-select',
  'grid',
] as const;

export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

export const CHOICE_FIELD_KINDS: readonly FormFieldKind[] = [
  'dropdown',
  'radio',
  'multi-select',
  'grid',
];

/** One question in a `grid` field, answered from the field's options. */
export type GridRow = {
  /** Editor-local; never persisted. */
  localId: string;
  title: string;
  /** Set on a stored row. Its answers are keyed by it, so a rename keeps it. */
  key?: string;
};

export type BuilderField = {
  /** Editor-local; never persisted. */
  localId: string;
  /** JSON Schema property name — what submissions are keyed by. */
  key: string;
  /** Once saved the key is frozen: renaming would orphan existing answers. */
  isKeyFrozen: boolean;
  kind: FormFieldKind;
  title: string;
  description: string;
  isRequired: boolean;
  options: string[];
  /** Set only on a `grid`. */
  rows: GridRow[];
};

export type BuilderForm = {
  /** Admin-facing row label; participants see `title`. */
  name: string;
  title: string;
  description: string;
  phaseId: string;
  fields: BuilderField[];
};

const createEmptyForm = (phaseId: string): BuilderForm => ({
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
  rows: [],
});

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
 * Keywords `buildDefinition` writes back. Anything else on a field — `minimum`,
 * `maxLength`, `pattern`, `minItems` — would be dropped on save, so a field
 * carrying one counts as unsupported rather than silently losing it.
 */
const ROUND_TRIPPED_FIELD_KEYS = new Set([
  'type',
  'title',
  'description',
  'x-format',
  'enum',
  'items',
  'uniqueItems',
]);

/** The same, for a `grid`. */
const ROUND_TRIPPED_GRID_KEYS = new Set([
  'type',
  'title',
  'description',
  'x-format',
  'properties',
  'x-field-order',
  'required',
]);

const ROUND_TRIPPED_GRID_ROW_KEYS = new Set(['type', 'title', 'enum']);

/** The same, for the definition itself. */
const ROUND_TRIPPED_DEFINITION_KEYS = new Set([
  'type',
  'title',
  'description',
  'x-phase',
  'required',
  'properties',
  'x-field-order',
]);

/**
 * `unsupportedKeys` names fields this editor cannot represent. Saving would
 * drop them, so a caller that gets any must refuse to edit the form.
 */
export const parseDefinition = ({
  schema,
  phaseId,
  name,
}: {
  schema: Record<string, unknown>;
  /** Resolved by the server, not read off the schema. */
  phaseId: string;
  name: string;
}): { form: BuilderForm; unsupportedKeys: string[] } => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((key): key is string => typeof key === 'string')
      : [],
  );
  const keys = getOrderedKeys(schema);

  const fields: BuilderField[] = [];
  const unsupportedKeys: string[] = [];

  for (const key of keys) {
    const field = parseField({
      key,
      property: properties[key],
      isRequired: required.has(key),
    });
    if (field) {
      fields.push(field);
    } else {
      unsupportedKeys.push(key);
    }
  }

  // A keyword on the definition itself would be dropped just as silently.
  const unsupportedRoot = Object.keys(schema).filter(
    (key) => !ROUND_TRIPPED_DEFINITION_KEYS.has(key),
  );

  return {
    form: {
      name,
      title: typeof schema.title === 'string' ? schema.title : '',
      description:
        typeof schema.description === 'string' ? schema.description : '',
      phaseId,
      fields,
    },
    unsupportedKeys: [...unsupportedKeys, ...unsupportedRoot],
  };
};

/** Null when the builder cannot represent the property. */
const parseField = ({
  key,
  property,
  isRequired,
}: {
  key: string;
  property: unknown;
  isRequired: boolean;
}): BuilderField | null => {
  if (!isRecord(property)) {
    return null;
  }

  const kind = resolveFieldKind(property);
  if (!kind || !isRoundTrippable({ property, isRequired })) {
    return null;
  }

  return {
    localId: key,
    key,
    isKeyFrozen: true,
    kind,
    title: typeof property.title === 'string' ? property.title : key,
    description:
      typeof property.description === 'string' ? property.description : '',
    isRequired,
    options:
      kind === 'grid' ? readGridColumns(property) : readOptions(property),
    rows: kind === 'grid' ? readGridRows(property) : [],
  };
};

const isRoundTrippable = ({
  property,
  isRequired,
}: {
  property: Record<string, unknown>;
  isRequired: boolean;
}): boolean => {
  if (property['x-format'] === 'grid') {
    return (
      Object.keys(property).every((key) => ROUND_TRIPPED_GRID_KEYS.has(key)) &&
      isGridRoundTrippable({ property, isRequired })
    );
  }

  return Object.keys(property).every((key) =>
    ROUND_TRIPPED_FIELD_KEYS.has(key),
  );
};

/**
 * Every row must share the first row's choices, and `required` must list all
 * rows or none: the builder writes back only those shapes.
 */
const isGridRoundTrippable = ({
  property,
  isRequired,
}: {
  property: Record<string, unknown>;
  isRequired: boolean;
}): boolean => {
  const rowProperties = isRecord(property.properties)
    ? property.properties
    : {};
  const columns = readGridColumns(property);
  const rowKeys = Object.keys(rowProperties);
  const rowsRequired = Array.isArray(property.required)
    ? property.required
    : [];
  const expectedRequired = isRequired ? rowKeys : [];

  const areRowsRoundTrippable = Object.values(rowProperties).every(
    (row) =>
      isRecord(row) &&
      row.type === 'string' &&
      Object.keys(row).every((key) => ROUND_TRIPPED_GRID_ROW_KEYS.has(key)) &&
      isSameList(readOptions(row), columns),
  );

  return (
    areRowsRoundTrippable &&
    rowsRequired.length === expectedRequired.length &&
    expectedRequired.every((key) => rowsRequired.includes(key))
  );
};

const isSameList = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const countFields = (schema: Record<string, unknown>): number =>
  Object.keys(isRecord(schema.properties) ? schema.properties : {}).length;

export const initialDraftFor = ({
  form,
  phases,
  occupiedPhaseIds,
}: {
  form?: {
    schema: Record<string, unknown>;
    phaseId: string | null;
    name: string;
  };
  phases: readonly { phaseId: string }[];
  occupiedPhaseIds: readonly string[];
}): { form: BuilderForm; unsupportedKeys: string[] } => {
  if (!form) {
    const firstFree = phases.find(
      (phase) => !occupiedPhaseIds.includes(phase.phaseId),
    );

    return {
      form: createEmptyForm(firstFree?.phaseId ?? ''),
      unsupportedKeys: [],
    };
  }

  return parseDefinition({
    schema: form.schema,
    // An unresolved phase still has to open on something.
    phaseId: form.phaseId ?? phases[0]?.phaseId ?? '',
    name: form.name,
  });
};

/**
 * Falls back to the raw id: a form bound to a since-removed phase is still
 * served to participants, so hiding it would hide a live form.
 */
export const resolvePhaseBadge = ({
  phaseId,
  phases,
  unsetLabel,
}: {
  phaseId: string | null;
  phases: readonly { phaseId: string; name: string | null }[];
  unsetLabel: string;
}): { label: string; isKnownPhase: boolean } => {
  if (!phaseId) {
    return { label: unsetLabel, isKnownPhase: false };
  }

  const phase = phases.find((entry) => entry.phaseId === phaseId);

  return {
    label: phase?.name ?? phaseId,
    isKnownPhase: phase !== undefined,
  };
};

/** Codes, not sentences: the copy lives in the dictionaries. Each code names
 *  exactly one control, so the dialog can render its message there. */
export type DraftProblem = {
  code: DraftProblemCode;
  /**
   * `localId` of the field it belongs to; absent on form-level problems. The
   * editor's own id rather than a position, so moving or removing a field
   * after a failed save cannot leave the message on a different field.
   */
  fieldLocalId?: string;
  /** The cap a `*-too-long` or `too-many-fields` problem names. */
  max?: number;
  /** Set only on `schema`. */
  detail?: string;
};

export type DraftProblemCode =
  | 'missing-name'
  | 'name-too-long'
  | 'missing-phase'
  | 'missing-title'
  | 'title-too-long'
  | 'description-too-long'
  | 'no-fields'
  | 'too-many-fields'
  | 'field-missing-question'
  | 'field-question-too-long'
  | 'field-description-too-long'
  | 'field-missing-options'
  | 'field-missing-rows'
  | 'grid-row-too-long'
  | 'schema';

/** Explicit checks first so the author sees translated copy; `schema` is the
 *  backstop for a shape they did not predict. */
export const validateDraft = (
  draft: BuilderForm,
):
  | { ok: true; definition: CustomFormDefinitionInput }
  | { ok: false; problems: DraftProblem[] } => {
  const problems = describeDraftProblems(draft);
  const parsed = customFormDefinitionInputSchema.safeParse(
    buildDefinition(draft),
  );

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        code: 'schema' as const,
        detail: issue.message,
      })),
    };
  }

  return { ok: true, definition: parsed.data };
};

const describeDraftProblems = (draft: BuilderForm): DraftProblem[] => [
  ...describeFormProblems(draft),
  ...draft.fields.flatMap(describeFieldProblems),
];

const describeFormProblems = (draft: BuilderForm): DraftProblem[] => [
  ...(draft.name.trim() ? [] : [{ code: 'missing-name' as const }]),
  ...getTooLongProblems({
    value: draft.name,
    max: FORM_CHARACTER_LIMITS.name,
    code: 'name-too-long',
  }),
  ...(draft.phaseId ? [] : [{ code: 'missing-phase' as const }]),
  ...(draft.title.trim() ? [] : [{ code: 'missing-title' as const }]),
  ...getTooLongProblems({
    value: draft.title,
    max: FORM_CHARACTER_LIMITS.title,
    code: 'title-too-long',
  }),
  ...getTooLongProblems({
    value: draft.description,
    max: FORM_CHARACTER_LIMITS.description,
    code: 'description-too-long',
  }),
  ...(draft.fields.length > 0 ? [] : [{ code: 'no-fields' as const }]),
  ...(draft.fields.length > CUSTOM_FORM_MAX_FIELDS
    ? [{ code: 'too-many-fields' as const, max: CUSTOM_FORM_MAX_FIELDS }]
    : []),
];

const describeFieldProblems = ({
  localId: fieldLocalId,
  title,
  description,
  kind,
  options,
  rows,
}: BuilderField): DraftProblem[] => [
  ...(title.trim()
    ? []
    : [{ code: 'field-missing-question' as const, fieldLocalId }]),
  ...getTooLongProblems({
    value: title,
    max: FORM_CHARACTER_LIMITS.fieldTitle,
    code: 'field-question-too-long',
    fieldLocalId,
  }),
  ...getTooLongProblems({
    value: description,
    max: FORM_CHARACTER_LIMITS.fieldDescription,
    code: 'field-description-too-long',
    fieldLocalId,
  }),
  ...(CHOICE_FIELD_KINDS.includes(kind) && options.length === 0
    ? [{ code: 'field-missing-options' as const, fieldLocalId }]
    : []),
  ...(kind === 'grid' && !rows.some((row) => row.title.trim())
    ? [{ code: 'field-missing-rows' as const, fieldLocalId }]
    : []),
  // One message, shown under the rows list.
  ...(rows.some(
    (row) => row.title.trim().length > FORM_CHARACTER_LIMITS.gridRowTitle,
  )
    ? [
        {
          code: 'grid-row-too-long' as const,
          max: FORM_CHARACTER_LIMITS.gridRowTitle,
          fieldLocalId,
        },
      ]
    : []),
];

/** Measured as `buildDefinition` would store the value, not as it was typed:
 *  padding a trim removes is not overflow. */
const getTooLongProblems = ({
  value,
  max,
  code,
  fieldLocalId,
}: {
  value: string;
  max: number;
  code: DraftProblemCode;
  fieldLocalId?: string;
}): DraftProblem[] =>
  value.trim().length > max ? [{ code, max, fieldLocalId }] : [];

/** Falls back to a positional name: a label in a non-Latin script slugs to
 *  nothing, and a form still needs a key for it. */
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

/**
 * The rows a grid stores, in order. Blank rows are dropped. A stored row keeps
 * its key; a new row gets one from its title.
 */
const resolveGridRowKeys = (
  rows: readonly GridRow[],
): { key: string; title: string }[] => {
  const titledRows = rows.filter((row) => row.title.trim());
  const takenKeys = titledRows.flatMap((row) => (row.key ? [row.key] : []));

  return titledRows.map((row, index) => {
    const title = row.title.trim();
    if (row.key) {
      return { key: row.key, title };
    }

    const key = deriveFieldKey({ title, takenKeys, fallbackIndex: index });
    takenKeys.push(key);

    return { key, title };
  });
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
    case 'grid':
      // Spread: an interface has no index signature to satisfy the loose type.
      return { ...buildGridSchema(field) };
  }
};

/** Also what the editor previews, so it shows what participants will get. */
export const buildGridSchema = (field: BuilderField): XFormatPropertySchema => {
  const rows = resolveGridRowKeys(field.rows);
  const rowKeys = rows.map((row) => row.key);

  return {
    title: field.title.trim(),
    ...(field.description.trim()
      ? { description: field.description.trim() }
      : {}),
    type: 'object',
    'x-format': 'grid',
    properties: Object.fromEntries(
      rows.map((row) => [
        row.key,
        { type: 'string', title: row.title, enum: field.options },
      ]),
    ),
    'x-field-order': rowKeys,
    required: field.isRequired ? rowKeys : [],
  };
};

/** Branch order mirrors the renderer's, so the kind shown is the control
 *  participants actually get. Null when the editor can't round-trip it. */
const resolveFieldKind = (
  property: Record<string, unknown>,
): FormFieldKind | null => {
  if (property.type === 'boolean') {
    return 'checkbox';
  }

  if (property.type === 'array') {
    return readOptions(property).length > 0 ? 'multi-select' : null;
  }

  if (property.type === 'object') {
    return resolveGridKind(property);
  }

  return resolveChoiceKind(property) ?? resolveTypedTextKind(property);
};

/** undefined when the property is not a choice field, so the caller keeps
 *  looking; null when it is one the renderer would leave blank. */
const resolveChoiceKind = (
  property: Record<string, unknown>,
): FormFieldKind | null | undefined => {
  const format = property['x-format'];
  const hasOptions = readOptions(property).length > 0;

  if (hasOptions) {
    return format === 'radio' ? 'radio' : 'dropdown';
  }

  return format === 'dropdown' || format === 'radio' ? null : undefined;
};

/** Null for an object that is not a grid, or a grid the renderer would skip. */
const resolveGridKind = (
  property: Record<string, unknown>,
): FormFieldKind | null =>
  property['x-format'] === 'grid' &&
  readGridRows(property).length > 0 &&
  readGridColumns(property).length > 0
    ? 'grid'
    : null;

const resolveTypedTextKind = (
  property: Record<string, unknown>,
): FormFieldKind | null => {
  if (property.type === 'number' || property.type === 'integer') {
    return 'number';
  }

  if (property.type !== 'string') {
    return null;
  }

  const format = property['x-format'];

  if (format === 'long-text') {
    return 'long-text';
  }

  // `money` and `location` have no editor here.
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

const readGridRows = (property: Record<string, unknown>): GridRow[] => {
  const rowProperties = isRecord(property.properties)
    ? property.properties
    : {};

  return getOrderedKeys(property).map((key) => {
    const row = rowProperties[key];
    const title =
      isRecord(row) && typeof row.title === 'string' ? row.title : '';

    return { localId: key, key, title: title || key };
  });
};

/** A grid's columns are its first row's choices; `isGridRoundTrippable`
 *  refuses a grid whose rows differ. */
const readGridColumns = (property: Record<string, unknown>): string[] => {
  const rowProperties = isRecord(property.properties)
    ? property.properties
    : {};
  const firstRow = Object.values(rowProperties).find(isRecord);

  return firstRow ? readOptions(firstRow) : [];
};

/** `properties` keys ordered by `x-field-order`, then any it omits. Used for a
 *  form's fields and for a grid's rows. */
const getOrderedKeys = (schema: Record<string, unknown>): string[] => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const order = Array.isArray(schema['x-field-order'])
    ? schema['x-field-order'].filter(
        (key): key is string => typeof key === 'string',
      )
    : [];

  return [
    ...order.filter((key) => key in properties),
    ...Object.keys(properties).filter((key) => !order.includes(key)),
  ];
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

  // A key must start with a letter; re-lower-case whatever word ends up first.
  const trimmed = camel.replace(/^[^a-zA-Z]+/, '');

  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`.slice(0, 64);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
