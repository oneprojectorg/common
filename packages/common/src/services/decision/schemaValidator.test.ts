import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { schemaValidator } from './schemaValidator';

describe('schemaValidator money constraints', () => {
  // Mirrors the schema produced by the template builder (BudgetFieldConfig):
  // the budget is an object-typed money field and the cap lives on the OBJECT.
  const moneyTemplate: JSONSchema7 = {
    type: 'object',
    required: ['budget'],
    properties: {
      budget: {
        type: 'object',
        title: 'Budget',
        // @ts-expect-error vendor extension keyword
        'x-format': 'money',
        maximum: 10,
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', default: 'USD' },
        },
      },
    },
  };

  it('rejects a budget amount above the object-level maximum', () => {
    const result = schemaValidator.validate(moneyTemplate, {
      budget: { amount: 20, currency: 'USD' },
    });

    expect(result.valid).toBe(false);
  });

  it('accepts a budget amount within the maximum', () => {
    const result = schemaValidator.validate(moneyTemplate, {
      budget: { amount: 5, currency: 'USD' },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts a budget amount equal to the maximum', () => {
    const result = schemaValidator.validate(moneyTemplate, {
      budget: { amount: 10, currency: 'USD' },
    });

    expect(result.valid).toBe(true);
  });

  it('enforces an object-level minimum against the amount', () => {
    const minTemplate: JSONSchema7 = {
      type: 'object',
      properties: {
        budget: {
          type: 'object',
          title: 'Budget',
          // @ts-expect-error vendor extension keyword
          'x-format': 'money',
          minimum: 100,
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string', default: 'USD' },
          },
        },
      },
    };

    expect(
      schemaValidator.validate(minTemplate, {
        budget: { amount: 50, currency: 'USD' },
      }).valid,
    ).toBe(false);
    expect(
      schemaValidator.validate(minTemplate, {
        budget: { amount: 150, currency: 'USD' },
      }).valid,
    ).toBe(true);
  });

  it('still enforces a maximum declared directly on the amount', () => {
    const amountCapTemplate: JSONSchema7 = {
      type: 'object',
      properties: {
        budget: {
          type: 'object',
          // @ts-expect-error vendor extension keyword
          'x-format': 'money',
          properties: {
            amount: { type: 'number', maximum: 10 },
            currency: { type: 'string', default: 'USD' },
          },
        },
      },
    };

    expect(
      schemaValidator.validate(amountCapTemplate, {
        budget: { amount: 20, currency: 'USD' },
      }).valid,
    ).toBe(false);
  });
});
