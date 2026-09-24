import { describe, expect, it } from 'vitest';

import { SchemaValidator } from '../schemaValidator';
import type { RubricTemplateSchema, XFormatPropertySchema } from '../types';
import {
  buildMoneyFieldAnswer,
  getMoneyFieldCurrency,
  getMoneyFieldMinimum,
  isMoneyFieldSchema,
  resolveMoneyDisplayCurrency,
} from './money';

function moneySchema({
  title = 'Cost',
  currency = 'USD',
}: {
  title?: string;
  currency?: string | null;
} = {}): XFormatPropertySchema {
  return {
    type: 'object',
    title,
    'x-format': 'money',
    properties: {
      amount: { type: 'number', minimum: 0 },
      ...(currency
        ? { currency: { type: 'string', const: currency, default: currency } }
        : {}),
    },
    required: currency ? ['amount', 'currency'] : ['amount'],
    additionalProperties: false,
  };
}

describe('isMoneyFieldSchema', () => {
  it('detects a money field only from the declared x-format', () => {
    expect(isMoneyFieldSchema(moneySchema())).toBe(true);
    // Same object shape, no declaration — deliberately not a money field.
    expect(
      isMoneyFieldSchema({ type: 'object', properties: { amount: {} } }),
    ).toBe(false);
    expect(isMoneyFieldSchema({ type: 'integer', maximum: 5 })).toBe(false);
  });
});

describe('getMoneyFieldCurrency', () => {
  it('prefers const, then default', () => {
    expect(getMoneyFieldCurrency(moneySchema({ currency: 'EUR' }))).toBe('EUR');
    expect(
      getMoneyFieldCurrency({
        'x-format': 'money',
        properties: { currency: { type: 'string', default: 'GBP' } },
      }),
    ).toBe('GBP');
  });

  it('is undefined when no currency is declared or the code is malformed', () => {
    expect(
      getMoneyFieldCurrency(moneySchema({ currency: null })),
    ).toBeUndefined();
    expect(
      getMoneyFieldCurrency({
        'x-format': 'money',
        properties: { currency: { type: 'string', const: 'DOLLARS' } },
      }),
    ).toBeUndefined();
  });
});

describe('getMoneyFieldMinimum', () => {
  it('reads the declared amount.minimum, undefined when malformed', () => {
    expect(getMoneyFieldMinimum(moneySchema())).toBe(0);
    expect(getMoneyFieldMinimum({ 'x-format': 'money' })).toBeUndefined();
  });
});

describe('resolveMoneyDisplayCurrency', () => {
  it('guards Intl against malformed stored currency codes', () => {
    const schema = moneySchema({ currency: 'EUR' });
    expect(
      resolveMoneyDisplayCurrency({ amount: 1, currency: '!!' }, schema),
    ).toBe('EUR');
    expect(
      resolveMoneyDisplayCurrency({ amount: 1, currency: 'GBP' }, schema),
    ).toBe('GBP');
    // No template currency either → the documented fallback.
    expect(resolveMoneyDisplayCurrency({}, { 'x-format': 'money' })).toBe(
      'USD',
    );
  });
});

describe('buildMoneyFieldAnswer', () => {
  it('materializes the template currency at fill time', () => {
    expect(
      buildMoneyFieldAnswer(500, moneySchema({ currency: 'CAD' })),
    ).toEqual({
      amount: 500,
      currency: 'CAD',
    });
  });

  it('falls back to USD when the template declares no currency', () => {
    expect(buildMoneyFieldAnswer(1, { 'x-format': 'money' })).toEqual({
      amount: 1,
      currency: 'USD',
    });
  });
});

describe('AJV validation of a money criterion', () => {
  const validator = new SchemaValidator();
  const template: RubricTemplateSchema = {
    type: 'object',
    'x-field-order': ['cost'],
    properties: { cost: moneySchema() },
    required: ['cost'],
  };

  it('accepts a valid answer', () => {
    expect(
      validator.validate(template, { cost: { amount: 1000, currency: 'USD' } })
        .valid,
    ).toBe(true);
  });

  it('rejects a negative amount, an unknown key and a wrong currency', () => {
    expect(
      validator.validate(template, { cost: { amount: -1, currency: 'USD' } })
        .valid,
    ).toBe(false);
    expect(
      validator.validate(template, {
        cost: { amount: 1, currency: 'USD', total: 999 },
      }).valid,
    ).toBe(false);
    expect(
      validator.validate(template, { cost: { amount: 1, currency: 'EUR' } })
        .valid,
    ).toBe(false);
  });

  it('rejects a missing required money criterion', () => {
    expect(validator.validate(template, {}).valid).toBe(false);
  });
});
