import { describe, expect, it } from 'vitest';

import { schemaValidator } from './schemaValidator';

describe('SchemaValidator.validateJsonSchema', () => {
  it('accepts a location field carrying the x-map-default vendor extension', () => {
    const template = {
      type: 'object',
      properties: {
        location: {
          type: 'object',
          'x-format': 'location',
          'x-map-default': {
            center: { lng: -82.9988, lat: 39.9612 },
            zoom: 1,
          },
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lng: { type: 'number', minimum: -180, maximum: 180 },
          },
          required: ['lat', 'lng'],
        },
      },
      'x-field-order': ['location'],
      required: ['location'],
    };

    expect(() => schemaValidator.validateJsonSchema(template)).not.toThrow();
  });
});

describe('SchemaValidator.validate', () => {
  it('names a missing nested field by its own title', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        value: {
          type: 'object' as const,
          title: 'How valuable?',
          properties: {
            votingTool: {
              type: 'string' as const,
              title: 'A tool that runs the vote',
              enum: ['1', '2'],
            },
          },
          required: ['votingTool'],
        },
      },
    };

    expect(schemaValidator.validate(schema, { value: {} }).errors).toEqual({
      'value.votingTool': 'A tool that runs the vote is required',
    });
    expect(
      schemaValidator.validate(schema, { value: { votingTool: 1 } }).errors,
    ).toEqual({ 'value.votingTool': 'A tool that runs the vote must be text' });
  });

  it('falls back to the key of a field with no title, top-level or nested', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        notes: { type: 'string' as const },
        value: {
          type: 'object' as const,
          properties: { votingTool: { type: 'string' as const } },
          required: ['votingTool'],
        },
      },
      required: ['notes'],
    };

    expect(schemaValidator.validate(schema, { value: {} }).errors).toEqual({
      notes: 'notes is required',
      'value.votingTool': 'votingTool is required',
    });
  });
});

describe('SchemaValidator.coerceToSchema', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      categories: {
        type: 'array' as const,
        items: { type: 'string' as const },
      },
      category: { type: 'string' as const },
      score: { type: ['number' as const, 'null' as const] },
      flag: { type: 'boolean' as const },
      loose: true,
    },
  };

  it('wraps a scalar where the schema expects an array, and unwraps an array where it expects a scalar', () => {
    expect(
      schemaValidator.coerceToSchema(schema, {
        categories: 'a',
        category: ['b', 'c'],
        score: [],
      }),
    ).toEqual({ categories: ['a'], category: 'b', score: null });
  });

  it('leaves values alone that already match, are empty, or have no typed schema', () => {
    const data = {
      categories: ['a'],
      category: 'b',
      flag: [true],
      loose: ['x'],
      unknown: ['y'],
      score: null,
      skipped: undefined,
    };

    expect(schemaValidator.coerceToSchema(schema, data)).toEqual(data);
    expect(
      schemaValidator.coerceToSchema({ type: 'object' }, { category: ['b'] }),
    ).toEqual({ category: ['b'] });
  });
});
