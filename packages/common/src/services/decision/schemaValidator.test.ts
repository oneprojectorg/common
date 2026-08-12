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

  it('accepts a budget add-up criterion with a nested x-field-order', () => {
    const template = {
      type: 'object',
      properties: {
        cost: {
          type: 'object',
          title: 'Total Estimated Cost',
          'x-format': 'money-group',
          properties: {
            design: { type: 'number', title: 'Design', minimum: 0 },
            currency: { type: 'string', const: 'USD', default: 'USD' },
          },
          additionalProperties: false,
          required: ['design', 'currency'],
          'x-field-order': ['design'],
        },
      },
      'x-field-order': ['cost'],
      required: ['cost'],
    };

    expect(() => schemaValidator.validateJsonSchema(template)).not.toThrow();
  });
});
