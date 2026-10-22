import {
  CUSTOM_FORM_MAX_FIELDS,
  customFormDefinitionInputSchema,
  schemaValidator,
} from '@op/common/client';
import { describe, expect, it } from 'vitest';

import type { BuilderField, BuilderForm } from './formDefinition';
import {
  FORM_CHARACTER_LIMITS,
  buildDefinition,
  deriveFieldKey,
  initialDraftFor,
  parseDefinition,
  resolvePhaseBadge,
  validateDraft,
} from './formDefinition';

const overLimit = (max: number) => 'a'.repeat(max + 1);

const field = (overrides: Partial<BuilderField> = {}): BuilderField => {
  const base: BuilderField = {
    localId: 'local',
    key: 'answer',
    isKeyFrozen: false,
    kind: 'short-text',
    title: 'Answer',
    description: '',
    isRequired: false,
    options: [],
    ...overrides,
  };

  return { ...base, localId: overrides.localId ?? base.key };
};

const form = (fields: BuilderField[]): BuilderForm => ({
  name: 'Exit survey',
  title: 'Your voice shapes Common.',
  description: 'Take our 1-minute survey.',
  phaseId: 'voting',
  fields,
});

describe('buildDefinition', () => {
  it('produces a definition the service layer accepts', () => {
    const definition = buildDefinition(
      form([
        field({
          key: 'wasAdmin',
          title: 'Were you an admin?',
          kind: 'radio',
          options: ['Yes', 'No'],
        }),
        field({ key: 'notes', title: 'Anything else?', kind: 'long-text' }),
      ]),
    );

    expect(customFormDefinitionInputSchema.safeParse(definition).success).toBe(
      true,
    );
  });

  it('binds the form to the selected phase', () => {
    const definition = buildDefinition(form([field({ key: 'answer' })]));

    expect(definition['x-phase']).toBe('voting');
  });

  it('orders fields as the editor lists them', () => {
    const definition = buildDefinition(
      form([
        field({ key: 'second', localId: 'b' }),
        field({ key: 'first', localId: 'a' }),
      ]),
    );

    expect(definition['x-field-order']).toEqual(['second', 'first']);
  });

  it('lists only the fields marked required', () => {
    const definition = buildDefinition(
      form([
        field({ key: 'needed', isRequired: true }),
        field({ key: 'optional', localId: 'b' }),
      ]),
    );

    expect(definition.required).toEqual(['needed']);
  });

  it('writes a multi-select as an array of unique enum strings', () => {
    const definition = buildDefinition(
      form([
        field({
          key: 'reasons',
          kind: 'multi-select',
          options: ['Features', 'Ease of use'],
        }),
      ]),
    );

    expect(definition.properties.reasons).toEqual({
      title: 'Answer',
      type: 'array',
      items: { type: 'string', enum: ['Features', 'Ease of use'] },
      uniqueItems: true,
    });
  });

  it('produces a schema the submit-time validator accepts answers against', () => {
    // AJV compiles the definition at submit time — a keyword it rejects fails
    // there, long after the form looked saved.
    const definition = buildDefinition(
      form([
        field({ key: 'wasAdmin', kind: 'radio', options: ['Yes', 'No'] }),
        field({
          key: 'reasons',
          kind: 'multi-select',
          options: ['Features', 'Ease of use'],
          localId: 'b',
        }),
        field({ key: 'score', kind: 'number', localId: 'c', isRequired: true }),
        field({ key: 'notes', kind: 'long-text', localId: 'd' }),
      ]),
    );

    expect(
      schemaValidator.validate(definition, {
        wasAdmin: 'Yes',
        reasons: ['Features'],
        score: 7,
        notes: 'Worked well.',
      }),
    ).toEqual({ valid: true, errors: {} });
  });

  it('produces a schema that rejects an answer outside the options', () => {
    const definition = buildDefinition(
      form([field({ key: 'wasAdmin', kind: 'radio', options: ['Yes', 'No'] })]),
    );

    expect(
      schemaValidator.validate(definition, { wasAdmin: 'Maybe' }).valid,
    ).toBe(false);
  });

  it('produces a schema that holds a required field to being answered', () => {
    const definition = buildDefinition(
      form([field({ key: 'answer', isRequired: true })]),
    );

    expect(schemaValidator.validate(definition, {}).valid).toBe(false);
  });

  it('omits an empty description rather than storing a blank string', () => {
    const definition = buildDefinition({
      ...form([field({ key: 'answer', description: '   ' })]),
      description: '',
    });

    expect(definition).not.toHaveProperty('description');
    expect(definition.properties.answer).not.toHaveProperty('description');
  });
});

describe('parseDefinition', () => {
  it('round-trips every field kind the builder offers', () => {
    const original = form([
      field({ key: 'shortText', kind: 'short-text' }),
      field({ key: 'longText', kind: 'long-text', localId: 'b' }),
      field({ key: 'amount', kind: 'number', localId: 'c' }),
      field({ key: 'agreed', kind: 'checkbox', localId: 'd' }),
      field({
        key: 'pick',
        kind: 'dropdown',
        options: ['A', 'B'],
        localId: 'e',
      }),
      field({ key: 'score', kind: 'radio', options: ['0', '1'], localId: 'f' }),
      field({
        key: 'reasons',
        kind: 'multi-select',
        options: ['A', 'B'],
        localId: 'g',
        isRequired: true,
      }),
    ]);

    const { form: parsed, unsupportedKeys } = parseDefinition({
      schema: buildDefinition(original),
      phaseId: 'voting',
      name: 'Exit survey',
    });

    expect(unsupportedKeys).toEqual([]);
    expect(parsed.fields.map((entry) => [entry.key, entry.kind])).toEqual([
      ['shortText', 'short-text'],
      ['longText', 'long-text'],
      ['amount', 'number'],
      ['agreed', 'checkbox'],
      ['pick', 'dropdown'],
      ['score', 'radio'],
      ['reasons', 'multi-select'],
    ]);
    expect(parsed.fields.at(-1)?.isRequired).toBe(true);
    expect(parsed.fields.at(-1)?.options).toEqual(['A', 'B']);
  });

  it('freezes the keys of a stored form so editing cannot orphan submissions', () => {
    const { form: parsed } = parseDefinition({
      schema: buildDefinition(form([field({ key: 'answer' })])),
      phaseId: 'voting',
      name: 'Exit survey',
    });

    expect(parsed.fields.every((entry) => entry.isKeyFrozen)).toBe(true);
  });

  it('reports a field the builder cannot represent instead of dropping it', () => {
    const { form: parsed, unsupportedKeys } = parseDefinition({
      schema: {
        type: 'object',
        title: 'Where',
        properties: {
          site: { type: 'string', title: 'Site', 'x-format': 'location' },
          note: { type: 'string', title: 'Note' },
        },
        'x-field-order': ['site', 'note'],
      },
      phaseId: 'submission',
      name: 'Site form',
    });

    expect(unsupportedKeys).toEqual(['site']);
    expect(parsed.fields.map((entry) => entry.key)).toEqual(['note']);
  });

  it('reports a field carrying a constraint the builder would drop on save', () => {
    const { unsupportedKeys } = parseDefinition({
      schema: {
        type: 'object',
        title: 'Limits',
        properties: {
          bio: { type: 'string', title: 'Bio', maxLength: 500 },
          plain: { type: 'string', title: 'Plain' },
        },
        'x-field-order': ['bio', 'plain'],
      },
      phaseId: 'submission',
      name: 'Limits',
    });

    expect(unsupportedKeys).toEqual(['bio']);
  });

  it('reports a keyword on the definition itself', () => {
    const { unsupportedKeys } = parseDefinition({
      schema: {
        type: 'object',
        title: 'Strict',
        additionalProperties: false,
        properties: { note: { type: 'string', title: 'Note' } },
        'x-field-order': ['note'],
      },
      phaseId: 'submission',
      name: 'Strict',
    });

    expect(unsupportedKeys).toContain('additionalProperties');
  });

  it('reports a choice field with no options — the renderer draws nothing for it', () => {
    const { unsupportedKeys } = parseDefinition({
      schema: {
        type: 'object',
        title: 'Pick',
        properties: {
          choice: { type: 'string', title: 'Choice', 'x-format': 'dropdown' },
        },
        'x-field-order': ['choice'],
      },
      phaseId: 'submission',
      name: 'Pick form',
    });

    expect(unsupportedKeys).toEqual(['choice']);
  });

  it('falls back to property order when x-field-order omits a field', () => {
    const { form: parsed } = parseDefinition({
      schema: {
        type: 'object',
        title: 'Partial order',
        properties: {
          first: { type: 'string', title: 'First' },
          second: { type: 'string', title: 'Second' },
        },
        'x-field-order': ['second'],
      },
      phaseId: 'submission',
      name: 'Partial',
    });

    expect(parsed.fields.map((entry) => entry.key)).toEqual([
      'second',
      'first',
    ]);
  });

  it('uses the phase the server resolved, not the stored x-phase', () => {
    const { form: parsed } = parseDefinition({
      schema: {
        type: 'object',
        title: 'Legacy',
        properties: { note: { type: 'string', title: 'Note' } },
      },
      phaseId: 'submission',
      name: 'Legacy',
    });

    expect(parsed.phaseId).toBe('submission');
  });
});

describe('initialDraftFor', () => {
  const phases = [
    { phaseId: 'submission' },
    { phaseId: 'review' },
    { phaseId: 'voting' },
  ];

  it('points a new form at the first phase with room for one', () => {
    const { form: draft } = initialDraftFor({
      phases,
      occupiedPhaseIds: ['submission', 'review'],
    });

    expect(draft.phaseId).toBe('voting');
    expect(draft.fields).toEqual([]);
  });

  it('leaves the phase unset when every phase is taken', () => {
    const { form: draft } = initialDraftFor({
      phases,
      occupiedPhaseIds: ['submission', 'review', 'voting'],
    });

    expect(draft.phaseId).toBe('');
  });

  it('opens a stored form on the phase the server resolved', () => {
    const { form: draft } = initialDraftFor({
      form: {
        schema: buildDefinition(form([field({ key: 'answer' })])),
        phaseId: 'review',
        name: 'Mid-process check',
      },
      phases,
      occupiedPhaseIds: [],
    });

    expect(draft.phaseId).toBe('review');
    expect(draft.name).toBe('Mid-process check');
  });

  it('falls back to the first phase when the server resolved none', () => {
    const { form: draft } = initialDraftFor({
      form: {
        schema: { type: 'object', title: 'Legacy', properties: {} },
        phaseId: null,
        name: 'Legacy',
      },
      phases,
      occupiedPhaseIds: [],
    });

    expect(draft.phaseId).toBe('submission');
  });
});

describe('resolvePhaseBadge', () => {
  const phases = [{ phaseId: 'voting', name: 'Voting' }];

  it('names a phase the process still configures', () => {
    expect(
      resolvePhaseBadge({ phaseId: 'voting', phases, unsetLabel: 'No phase' }),
    ).toEqual({ label: 'Voting', isKnownPhase: true });
  });

  it('shows the raw id of a phase the process no longer has', () => {
    // The form is still served to participants, so it must stay visible.
    expect(
      resolvePhaseBadge({ phaseId: 'retired', phases, unsetLabel: 'No phase' }),
    ).toEqual({ label: 'retired', isKnownPhase: false });
  });

  it('falls back to the unset label when there is no phase at all', () => {
    expect(
      resolvePhaseBadge({ phaseId: null, phases, unsetLabel: 'No phase' }),
    ).toEqual({ label: 'No phase', isKnownPhase: false });
  });

  it('shows the raw id when the phase is configured but unnamed', () => {
    expect(
      resolvePhaseBadge({
        phaseId: 'voting',
        phases: [{ phaseId: 'voting', name: null }],
        unsetLabel: 'No phase',
      }),
    ).toEqual({ label: 'voting', isKnownPhase: true });
  });
});

describe('validateDraft', () => {
  const problemCodes = (draft: BuilderForm) => {
    const result = validateDraft(draft);
    return result.ok ? [] : result.problems.map((problem) => problem.code);
  };

  it('returns the definition to save when the draft is complete', () => {
    const result = validateDraft(form([field({ key: 'answer' })]));

    expect(result.ok).toBe(true);
    expect(result.ok && result.definition['x-phase']).toBe('voting');
  });

  it('reports a missing internal name', () => {
    expect(
      problemCodes({ ...form([field({ key: 'answer' })]), name: '  ' }),
    ).toContain('missing-name');
  });

  it('reports a missing phase', () => {
    expect(
      problemCodes({ ...form([field({ key: 'answer' })]), phaseId: '' }),
    ).toContain('missing-phase');
  });

  it('reports a missing participant heading', () => {
    expect(
      problemCodes({ ...form([field({ key: 'answer' })]), title: '' }),
    ).toContain('missing-title');
  });

  it('reports a form with no fields', () => {
    expect(problemCodes(form([]))).toContain('no-fields');
  });

  it('reports a field with no question, by the field it belongs to', () => {
    const result = validateDraft(
      form([
        field({ key: 'first' }),
        field({ key: 'second', title: '   ', localId: 'b' }),
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.problems).toEqual([
      { code: 'field-missing-question', fieldLocalId: 'b' },
    ]);
  });

  it('reports a choice field with no options', () => {
    const result = validateDraft(
      form([field({ key: 'pick', kind: 'dropdown', options: [] })]),
    );

    expect(result.ok === false && result.problems).toEqual([
      { code: 'field-missing-options', fieldLocalId: 'pick' },
    ]);
  });

  it('does not ask a text field for options', () => {
    expect(problemCodes(form([field({ key: 'answer' })]))).toEqual([]);
  });

  it('prefers its own codes over a raw schema message', () => {
    expect(problemCodes(form([]))).not.toContain('schema');
  });

  // A stored form authored before these caps opens with values past them, so
  // the length checks are reachable even though `maxLength` bounds typing.
  it('reports an internal name past the limit, naming the cap', () => {
    const result = validateDraft({
      ...form([field({ key: 'answer' })]),
      name: overLimit(FORM_CHARACTER_LIMITS.name),
    });

    expect(result.ok === false && result.problems).toEqual([
      { code: 'name-too-long', max: FORM_CHARACTER_LIMITS.name },
    ]);
  });

  it('reports a heading past the limit', () => {
    const result = validateDraft({
      ...form([field({ key: 'answer' })]),
      title: overLimit(FORM_CHARACTER_LIMITS.title),
    });

    expect(result.ok === false && result.problems).toEqual([
      { code: 'title-too-long', max: FORM_CHARACTER_LIMITS.title },
    ]);
  });

  it('reports intro text past the limit', () => {
    const result = validateDraft({
      ...form([field({ key: 'answer' })]),
      description: overLimit(FORM_CHARACTER_LIMITS.description),
    });

    expect(result.ok === false && result.problems).toEqual([
      { code: 'description-too-long', max: FORM_CHARACTER_LIMITS.description },
    ]);
  });

  it('reports a question past the limit, by the field it belongs to', () => {
    const result = validateDraft(
      form([
        field({ key: 'first' }),
        field({
          key: 'second',
          localId: 'b',
          title: overLimit(FORM_CHARACTER_LIMITS.fieldTitle),
        }),
      ]),
    );

    expect(result.ok === false && result.problems).toEqual([
      {
        code: 'field-question-too-long',
        fieldLocalId: 'b',
        max: FORM_CHARACTER_LIMITS.fieldTitle,
      },
    ]);
  });

  it('reports helper text past the limit, by the field it belongs to', () => {
    const result = validateDraft(
      form([
        field({
          key: 'answer',
          description: overLimit(FORM_CHARACTER_LIMITS.fieldDescription),
        }),
      ]),
    );

    expect(result.ok === false && result.problems).toEqual([
      {
        code: 'field-description-too-long',
        fieldLocalId: 'answer',
        max: FORM_CHARACTER_LIMITS.fieldDescription,
      },
    ]);
  });

  it('measures a value as it would be stored, not as it was typed', () => {
    // `buildDefinition` trims, so padding that a trim removes is not overflow.
    const padded = `  ${'a'.repeat(FORM_CHARACTER_LIMITS.title)}  `;

    expect(
      problemCodes({ ...form([field({ key: 'answer' })]), title: padded }),
    ).toEqual([]);
  });

  it('names the field by its editor id, which reordering does not change', () => {
    const first = field({ key: 'first', localId: 'a' });
    const blank = field({ key: 'second', localId: 'b', title: '   ' });

    // The author moves the offending field while the message is on screen;
    // a positional reference would now point at the other one.
    expect(problemCodes(form([first, blank]))).toEqual(
      problemCodes(form([blank, first])),
    );
    expect(validateDraft(form([blank, first]))).toEqual({
      ok: false,
      problems: [{ code: 'field-missing-question', fieldLocalId: 'b' }],
    });
  });

  it('reports more fields than a form can hold, naming the cap', () => {
    const tooMany = Array.from(
      { length: CUSTOM_FORM_MAX_FIELDS + 1 },
      (_, index) => field({ key: `answer${index}`, localId: `local${index}` }),
    );

    expect(problemCodes(form(tooMany))).toEqual(['too-many-fields']);
  });
});

describe('deriveFieldKey', () => {
  it('camel-cases a label', () => {
    expect(
      deriveFieldKey({
        title: 'Were you an admin?',
        takenKeys: [],
        fallbackIndex: 0,
      }),
    ).toBe('wereYouAnAdmin');
  });

  it('strips accents rather than dropping the characters', () => {
    expect(
      deriveFieldKey({ title: 'Été budget', takenKeys: [], fallbackIndex: 0 }),
    ).toBe('eteBudget');
  });

  it('drops leading digits so the key starts with a letter', () => {
    expect(
      deriveFieldKey({ title: '2024 budget', takenKeys: [], fallbackIndex: 0 }),
    ).toBe('budget');
  });

  it('falls back to a positional key when the label has no Latin characters', () => {
    expect(
      deriveFieldKey({ title: 'ما اسمك؟', takenKeys: [], fallbackIndex: 2 }),
    ).toBe('field3');
  });

  it('suffixes a key that is already taken', () => {
    expect(
      deriveFieldKey({
        title: 'Budget',
        takenKeys: ['budget', 'budget2'],
        fallbackIndex: 0,
      }),
    ).toBe('budget3');
  });
});
