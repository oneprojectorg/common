import type {
  CustomFormDefinitionInput,
  CustomFormField,
} from '@op/common/client';
import { customFormDefinitionInputSchema } from '@op/common/client';

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
] as const;

export type FormFieldKind = (typeof FORM_FIELD_KINDS)[number];

export const CHOICE_FIELD_KINDS: readonly FormFieldKind[] = [
  'dropdown',
  'radio',
  'multi-select',
];

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

/** Codes, not sentences: the copy lives in the dictionaries. `position` is the
 *  1-based field number. */
export type DraftProblem = {
  code: DraftProblemCode;
  position?: number;
  /** Set only on `schema`. */
  detail?: string;
};

export type DraftProblemCode =
  | 'missing-name'
  | 'missing-phase'
  | 'missing-title'
  | 'no-fields'
  | 'field-missing-question'
  | 'field-missing-options'
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

const describeDraftProblems = (draft: BuilderForm): DraftProblem[] => {
  const problems: DraftProblem[] = [
    ...(draft.name.trim() ? [] : [{ code: 'missing-name' as const }]),
    ...(draft.phaseId ? [] : [{ code: 'missing-phase' as const }]),
    ...(draft.title.trim() ? [] : [{ code: 'missing-title' as const }]),
    ...(draft.fields.length > 0 ? [] : [{ code: 'no-fields' as const }]),
  ];

  draft.fields.forEach((field, index) => {
    const position = index + 1;

    if (!field.title.trim()) {
      problems.push({ code: 'field-missing-question', position });
    }

    if (CHOICE_FIELD_KINDS.includes(field.kind) && field.options.length === 0) {
      problems.push({ code: 'field-missing-options', position });
    }
  });

  return problems;
};

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
