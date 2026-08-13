import type { JSONSchema7 } from 'json-schema';
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

describe('SchemaValidator.validate error messages', () => {
  /**
   * A multi-select category field, shaped the way `buildCategorySchema` emits
   * one: an array whose items match a `oneOf` branch per configured option.
   * `duplicateLabel` reproduces two categories sharing a label, which is
   * accepted at configuration time and only surfaces here.
   */
  const categorySchema = (duplicateLabel: boolean): JSONSchema7 => ({
    type: 'object',
    properties: {
      category: {
        type: 'array',
        title: 'Category',
        items: {
          type: 'string',
          oneOf: [
            { const: 'test', title: 'test' },
            ...(duplicateLabel ? [{ const: 'test', title: 'test' }] : []),
            { const: 'not-a-test', title: 'not-a-test' },
          ],
        },
        uniqueItems: true,
      },
    },
  });

  it('names the field rather than the array index of the failing item', () => {
    const result = schemaValidator.validate(categorySchema(false), {
      category: ['no-such-category'],
    });

    // Regression: the message read "0 is invalid" — the index of the failing
    // element — because the field name was taken from the last path segment.
    const message = Object.values(result.errors).join(', ');
    expect(result.valid).toBe(false);
    expect(message).toContain('Category');
    expect(message).not.toMatch(/^0\b/);
  });

  it('reports an unmatched selection as invalid', () => {
    const result = schemaValidator.validate(categorySchema(false), {
      category: ['no-such-category'],
    });

    expect(Object.values(result.errors)).toEqual([
      'Category has an invalid selection',
    ]);
  });

  it('blames the configuration when duplicate options make a value ambiguous', () => {
    const result = schemaValidator.validate(categorySchema(true), {
      category: ['test'],
    });

    // The submitter picked a real option; it matches two `oneOf` branches, so
    // "exactly one" cannot hold. Re-picking cannot fix it, so the message has
    // to point at the duplicate rather than at their choice.
    const message = Object.values(result.errors).join(', ');
    expect(result.valid).toBe(false);
    expect(message).toContain('duplicate options');
    expect(message).not.toContain('invalid selection');
  });

  it('accepts an unambiguous selection against the same schema', () => {
    expect(
      schemaValidator.validate(categorySchema(true), {
        category: ['not-a-test'],
      }).valid,
    ).toBe(true);
  });
});
