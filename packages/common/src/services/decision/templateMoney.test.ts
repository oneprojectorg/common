import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils';
import { SchemaValidator } from './schemaValidator';
import {
  assertMoneyFieldSchemas,
  buildMoneyFieldAnswer,
  getMoneyAnswerAmount,
  getMoneyAnswerCurrency,
  getMoneyFieldCurrency,
  isMoneyFieldSchema,
  isValidCurrencyCode,
  resolveMoneyDisplayCurrency,
} from './templateMoney';
import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

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

describe('answer readers', () => {
  it('reads a well-formed answer', () => {
    expect(getMoneyAnswerAmount({ amount: 1200.5, currency: 'USD' })).toBe(
      1200.5,
    );
    expect(getMoneyAnswerCurrency({ amount: 1, currency: 'eur' })).toBe('eur');
  });

  it('tolerates the partial / malformed shapes unvalidated drafts allow', () => {
    for (const value of [
      undefined,
      null,
      'nope',
      42,
      [],
      {},
      { amount: '12' },
      { amount: Number.NaN },
      { currency: 'USD' },
    ]) {
      expect(getMoneyAnswerAmount(value)).toBeNull();
    }
    expect(
      getMoneyAnswerCurrency({ amount: 1, currency: 'US$' }),
    ).toBeUndefined();
    expect(getMoneyAnswerCurrency({ amount: 1 })).toBeUndefined();
  });

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

  it('isValidCurrencyCode accepts three letters only', () => {
    expect(isValidCurrencyCode('usd')).toBe(true);
    expect(isValidCurrencyCode('US')).toBe(false);
    expect(isValidCurrencyCode('USDD')).toBe(false);
    expect(isValidCurrencyCode(12)).toBe(false);
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

describe('assertMoneyFieldSchemas', () => {
  function template(schema: XFormatPropertySchema): RubricTemplateSchema {
    return { type: 'object', properties: { cost: schema } };
  }

  it('accepts the canonical money shape', () => {
    expect(() =>
      assertMoneyFieldSchemas(template(moneySchema())),
    ).not.toThrow();
  });

  it('ignores properties that do not declare x-format money', () => {
    expect(() =>
      assertMoneyFieldSchemas(
        template({ type: 'object', properties: { amount: {} } }),
      ),
    ).not.toThrow();
  });

  it('ignores boolean subschemas', () => {
    expect(() =>
      assertMoneyFieldSchemas({
        type: 'object',
        properties: { blocked: false },
      }),
    ).not.toThrow();
  });

  // Each omission below would persist a template whose money input either
  // cannot be submitted or can store something the model forbids.
  const unsafe: Array<[string, XFormatPropertySchema]> = [
    ['a non-object type', { ...moneySchema(), type: 'number' }],
    [
      'a missing additionalProperties:false (a stored total becomes possible)',
      { ...moneySchema(), additionalProperties: undefined },
    ],
    [
      'additionalProperties:true',
      { ...moneySchema(), additionalProperties: true },
    ],
    ['an unrequired amount', { ...moneySchema(), required: ['currency'] }],
    ['an unrequired currency', { ...moneySchema(), required: ['amount'] }],
    [
      'a missing amount property',
      {
        ...moneySchema(),
        properties: {
          currency: { type: 'string', const: 'USD', default: 'USD' },
        },
      },
    ],
    [
      'an integer amount',
      {
        ...moneySchema(),
        properties: {
          amount: { type: 'integer', minimum: 0 },
          currency: { type: 'string', const: 'USD', default: 'USD' },
        },
      },
    ],
    [
      'an amount without minimum 0',
      {
        ...moneySchema(),
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', const: 'USD', default: 'USD' },
        },
      },
    ],
    [
      'a missing currency property (the renderer would store an extra key)',
      moneySchema({ currency: null }),
    ],
    [
      'a missing currency const',
      {
        ...moneySchema(),
        properties: {
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', default: 'USD' },
        },
      },
    ],
    [
      'a currency const that is not a valid ISO code',
      {
        ...moneySchema(),
        properties: {
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', const: 'US$', default: 'US$' },
        },
      },
    ],
    [
      'a currency default disagreeing with its const',
      {
        ...moneySchema(),
        properties: {
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', const: 'USD', default: 'EUR' },
        },
      },
    ],
  ];

  it.each(unsafe)('rejects %s', (_label, schema) => {
    expect(() => assertMoneyFieldSchemas(template(schema))).toThrow(
      ValidationError,
    );
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
