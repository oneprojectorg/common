import { customFormDefinitionInputSchema } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import type { BuilderField, BuilderForm } from './formDefinition';
import {
  buildDefinition,
  deriveFieldKey,
  parseDefinition,
} from './formDefinition';

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

  // Keep the local id distinct per field without every call site passing one.
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
    // A legacy form has no `x-phase`; the server resolves it to the initial
    // phase, and the editor must open on that phase rather than a blank one.
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
