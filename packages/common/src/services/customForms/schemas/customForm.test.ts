import { describe, expect, it } from 'vitest';

import {
  CUSTOM_FORM_MAX_FIELDS,
  customFormDefinitionInputSchema,
} from './customForm';

const definition = (overrides: Record<string, unknown> = {}) => ({
  type: 'object',
  title: 'Your voice shapes Common.',
  'x-phase': 'voting',
  required: [],
  properties: {
    npsScore: {
      type: 'string',
      title: 'How likely are you to recommend Common?',
      'x-format': 'radio',
      enum: ['0', '1', '2'],
    },
  },
  'x-field-order': ['npsScore'],
  ...overrides,
});

const parse = (value: unknown) =>
  customFormDefinitionInputSchema.safeParse(value);

describe('customFormDefinitionInputSchema', () => {
  it('accepts the shape the builder writes', () => {
    expect(parse(definition()).success).toBe(true);
  });

  it('requires a phase, so no form silently lands on the first one', () => {
    const { 'x-phase': _omitted, ...withoutPhase } = definition();

    expect(parse(withoutPhase).success).toBe(false);
  });

  it('rejects a form with no fields', () => {
    expect(
      parse(definition({ properties: {}, 'x-field-order': [] })).success,
    ).toBe(false);
  });

  it('rejects a field key that could poison a prototype', () => {
    for (const key of ['constructor', 'prototype', '__proto__']) {
      expect(
        parse(
          definition({
            properties: { [key]: { type: 'string', title: 'Hi' } },
            'x-field-order': [key],
          }),
        ).success,
      ).toBe(false);
    }
  });

  it('rejects a key that is not a usable property name', () => {
    expect(
      parse(
        definition({
          properties: { '2nd choice': { type: 'string', title: 'Hi' } },
          'x-field-order': ['2nd choice'],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects a field missing from the field order — nobody would see it', () => {
    expect(
      parse(
        definition({
          properties: {
            npsScore: { type: 'string', title: 'Score' },
            hidden: { type: 'string', title: 'Hidden' },
          },
          'x-field-order': ['npsScore'],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects a field order naming a field that does not exist', () => {
    expect(
      parse(definition({ 'x-field-order': ['npsScore', 'ghost'] })).success,
    ).toBe(false);
  });

  it('rejects a field order that repeats a field', () => {
    expect(
      parse(definition({ 'x-field-order': ['npsScore', 'npsScore'] })).success,
    ).toBe(false);
  });

  it('rejects a required entry that is not one of the fields', () => {
    expect(parse(definition({ required: ['ghost'] })).success).toBe(false);
  });

  it('rejects a choice field with no options', () => {
    expect(
      parse(
        definition({
          properties: {
            choice: { type: 'string', title: 'Pick', 'x-format': 'dropdown' },
          },
          'x-field-order': ['choice'],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects a multi-select with no options', () => {
    expect(
      parse(
        definition({
          properties: { reasons: { type: 'array', title: 'Why?' } },
          'x-field-order': ['reasons'],
        }),
      ).success,
    ).toBe(false);
  });

  it('accepts a multi-select with options under items', () => {
    expect(
      parse(
        definition({
          properties: {
            reasons: {
              type: 'array',
              title: 'Why?',
              items: { type: 'string', enum: ['A', 'B'] },
              uniqueItems: true,
            },
          },
          'x-field-order': ['reasons'],
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects options on a field whose type cannot carry them', () => {
    expect(
      parse(
        definition({
          properties: {
            amount: { type: 'number', title: 'How much?', enum: ['1', '2'] },
          },
          'x-field-order': ['amount'],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects more fields than one form may hold', () => {
    const properties: Record<string, unknown> = {};
    for (let index = 0; index <= CUSTOM_FORM_MAX_FIELDS; index += 1) {
      properties[`field${index}`] = { type: 'string', title: `Field ${index}` };
    }

    expect(
      parse(
        definition({
          properties,
          'x-field-order': Object.keys(properties),
        }),
      ).success,
    ).toBe(false);
  });
});
