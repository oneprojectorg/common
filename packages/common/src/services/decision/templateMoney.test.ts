import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils';
import { SchemaValidator } from './schemaValidator';
import {
  assertMoneyFieldSchemas,
  assertTemplateSectionCurrencies,
  buildMoneyFieldAnswer,
  getMoneyAnswerAmount,
  getMoneyAnswerCurrency,
  getMoneyFieldCurrency,
  isMoneyFieldSchema,
  isValidCurrencyCode,
  resolveMoneyDisplayCurrency,
  sumMoneyFields,
} from './templateMoney';
import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

function moneySchema({
  title = 'Cost',
  currency = 'USD',
  sectionId,
}: {
  title?: string;
  currency?: string | null;
  sectionId?: string;
} = {}): XFormatPropertySchema {
  return {
    type: 'object',
    title,
    'x-format': 'money',
    ...(sectionId ? { 'x-section': sectionId } : {}),
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

describe('sumMoneyFields', () => {
  const fields = [
    { key: 'a', schema: moneySchema() },
    { key: 'b', schema: moneySchema() },
    {
      key: 'notes',
      schema: { type: 'string' as const, 'x-format': 'long-text' as const },
    },
  ];

  it('sums the answered money members only', () => {
    expect(
      sumMoneyFields(fields, {
        a: { amount: 1000, currency: 'USD' },
        b: { amount: 250.5, currency: 'USD' },
        notes: 'long text is not money',
      }),
    ).toEqual({ total: 1250.5, currency: 'USD', answeredCount: 2 });
  });

  it('returns a null total when nothing is answered yet', () => {
    expect(sumMoneyFields(fields, {})).toEqual({
      total: null,
      currency: 'USD',
      answeredCount: 0,
    });
  });

  it('ignores partially filled members', () => {
    expect(
      sumMoneyFields(fields, { a: { amount: 10, currency: 'USD' }, b: {} }),
    ).toEqual({ total: 10, currency: 'USD', answeredCount: 1 });
  });

  it('takes the currency from the template pin when nothing is answered', () => {
    expect(
      sumMoneyFields([{ key: 'a', schema: moneySchema({ currency: 'EUR' }) }], {
        a: {},
      }).currency,
    ).toBe('EUR');
  });

  it('labels the total with the stored currency, not a re-pinned template', () => {
    // A historical review filled in USD, then the template was re-pinned to
    // EUR. The individual amounts still read USD (resolveMoneyDisplayCurrency),
    // so the derived total must agree instead of relabelling the same numbers.
    const repinned = [
      { key: 'a', schema: moneySchema({ currency: 'EUR' }) },
      { key: 'b', schema: moneySchema({ currency: 'EUR' }) },
    ];

    expect(
      sumMoneyFields(repinned, {
        a: { amount: 1000, currency: 'USD' },
        b: { amount: 250, currency: 'USD' },
      }),
    ).toEqual({ total: 1250, currency: 'USD', answeredCount: 2 });
  });

  it('ignores a malformed stored currency and falls back to the pin', () => {
    expect(
      sumMoneyFields([{ key: 'a', schema: moneySchema({ currency: 'EUR' }) }], {
        a: { amount: 5, currency: 'nonsense' },
      }).currency,
    ).toBe('EUR');
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

describe('assertTemplateSectionCurrencies', () => {
  function template(
    properties: Record<string, XFormatPropertySchema>,
    showTotal = true,
  ): RubricTemplateSchema {
    return {
      type: 'object',
      'x-sections': [{ id: 'cost', title: 'Total Estimated Cost', showTotal }],
      properties,
    };
  }

  it('accepts a summed section whose money members share a currency', () => {
    expect(() =>
      assertTemplateSectionCurrencies(
        template({
          a: moneySchema({ currency: 'USD', sectionId: 'cost' }),
          b: moneySchema({ currency: 'USD', sectionId: 'cost' }),
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a summed section that mixes currencies', () => {
    expect(() =>
      assertTemplateSectionCurrencies(
        template({
          a: moneySchema({ currency: 'USD', sectionId: 'cost' }),
          b: moneySchema({ currency: 'EUR', sectionId: 'cost' }),
        }),
      ),
    ).toThrow(ValidationError);
  });

  it('allows mixed currencies in a section that shows no total', () => {
    expect(() =>
      assertTemplateSectionCurrencies(
        template(
          {
            a: moneySchema({ currency: 'USD', sectionId: 'cost' }),
            b: moneySchema({ currency: 'EUR', sectionId: 'cost' }),
          },
          false,
        ),
      ),
    ).not.toThrow();
  });

  it('does not invent a default for an unpinned money field', () => {
    // No currency declared at all: assertMoneyFieldSchemas is the check that
    // reports it. This assertion must not substitute USD and thereby call a
    // mixed section "consistent" — nor crash.
    expect(() =>
      assertTemplateSectionCurrencies(
        template({
          a: moneySchema({ currency: 'EUR', sectionId: 'cost' }),
          b: moneySchema({ currency: null, sectionId: 'cost' }),
        }),
      ),
    ).not.toThrow();
  });

  it('ignores money fields outside the summed section', () => {
    expect(() =>
      assertTemplateSectionCurrencies(
        template({
          a: moneySchema({ currency: 'USD', sectionId: 'cost' }),
          loose: moneySchema({ currency: 'EUR' }),
        }),
      ),
    ).not.toThrow();
  });

  it('is a no-op for templates without sections', () => {
    expect(() =>
      assertTemplateSectionCurrencies({
        type: 'object',
        properties: { a: moneySchema() },
      }),
    ).not.toThrow();
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
