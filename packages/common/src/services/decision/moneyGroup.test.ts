import { describe, expect, it } from 'vitest';

import {
  getMoneyGroupCurrency,
  getMoneyGroupLineItems,
  getMoneyLineItemAmount,
  isMoneyGroupSchema,
  setMoneyLineItemAmount,
  sumMoneyGroupTotal,
} from './moneyGroup';
import type { XFormatPropertySchema } from './types';

/** Two required line items + one optional, currency pinned to USD. */
const schema: XFormatPropertySchema = {
  type: 'object',
  title: 'Total Estimated Cost',
  'x-format': 'money-group',
  properties: {
    a1b2c3d4: { type: 'number', title: 'Design', minimum: 0 },
    e5f6a7b8: { type: 'number', title: 'Construction', minimum: 0 },
    c9d0e1f2: { type: 'number', title: 'Contingency', minimum: 0 },
    currency: { type: 'string', const: 'USD', default: 'USD' },
  },
  additionalProperties: false,
  required: ['a1b2c3d4', 'e5f6a7b8', 'currency'],
  'x-field-order': ['a1b2c3d4', 'e5f6a7b8', 'c9d0e1f2'],
};

describe('isMoneyGroupSchema', () => {
  it('accepts a declared money group and rejects look-alikes', () => {
    expect(isMoneyGroupSchema(schema)).toBe(true);
    // The proposal budget field is an object with a currency too, but its
    // x-format is `money`, not `money-group`.
    expect(
      isMoneyGroupSchema({
        type: 'object',
        'x-format': 'money',
        properties: { amount: { type: 'number' } },
      }),
    ).toBe(false);
    expect(
      isMoneyGroupSchema({ type: 'string', 'x-format': 'long-text' }),
    ).toBe(false);
  });
});

describe('getMoneyGroupLineItems', () => {
  it('orders by x-field-order and flags required items, excluding currency', () => {
    expect(getMoneyGroupLineItems(schema)).toEqual([
      { id: 'a1b2c3d4', title: 'Design', required: true },
      { id: 'e5f6a7b8', title: 'Construction', required: true },
      { id: 'c9d0e1f2', title: 'Contingency', required: false },
    ]);
  });

  it('appends properties missing from x-field-order', () => {
    const items = getMoneyGroupLineItems({
      ...schema,
      'x-field-order': ['c9d0e1f2'],
    });

    expect(items.map((item) => item.id)).toEqual([
      'c9d0e1f2',
      'a1b2c3d4',
      'e5f6a7b8',
    ]);
  });
});

describe('getMoneyLineItemAmount', () => {
  it.each([
    ['a filled item', { a1b2c3d4: 1200, currency: 'USD' }, 1200],
    ['an unanswered item', { currency: 'USD' }, null],
    ['a non-numeric value', { a1b2c3d4: '1200', currency: 'USD' }, null],
    ['NaN', { a1b2c3d4: Number.NaN, currency: 'USD' }, null],
    ['an undefined answer', undefined, null],
    ['a non-object answer', 'nope', null],
  ])('reads %s', (_label, value, expected) => {
    expect(getMoneyLineItemAmount(value, 'a1b2c3d4')).toBe(expected);
  });
});

describe('sumMoneyGroupTotal', () => {
  it('sums only schema-declared line items, ignoring currency and stale keys', () => {
    const value = {
      a1b2c3d4: 100,
      e5f6a7b8: 200,
      currency: 'USD',
      // A line item removed from the template since this answer was saved.
      stale9999: 5000,
    };

    expect(sumMoneyGroupTotal(schema, value)).toBe(300);
  });

  it('sums decimals and treats unanswered items as zero', () => {
    expect(
      sumMoneyGroupTotal(schema, {
        a1b2c3d4: 19750.25,
        e5f6a7b8: 0.75,
        currency: 'USD',
      }),
    ).toBe(19751);
  });

  it('totals an untouched or partial group without throwing', () => {
    expect(sumMoneyGroupTotal(schema, undefined)).toBe(0);
    expect(sumMoneyGroupTotal(schema, {})).toBe(0);
    expect(sumMoneyGroupTotal(schema, { a1b2c3d4: 50 })).toBe(50);
  });
});

describe('getMoneyGroupCurrency', () => {
  it('prefers the stored currency so submitted reviews stay self-describing', () => {
    expect(getMoneyGroupCurrency(schema, { currency: 'EUR' })).toBe('EUR');
  });

  it('falls back to the template currency when the answer has none', () => {
    expect(getMoneyGroupCurrency(schema, { a1b2c3d4: 10 })).toBe('USD');
    expect(getMoneyGroupCurrency(schema)).toBe('USD');
  });

  it.each([
    ['', 'empty'],
    ['not-a-code', 'malformed'],
    ['US', 'too short'],
    [42, 'non-string'],
  ])('ignores a stored %s currency (%s) — drafts are unvalidated', (stored) => {
    expect(getMoneyGroupCurrency(schema, { currency: stored })).toBe('USD');
  });

  it('falls back to USD when the template declares no currency', () => {
    expect(
      getMoneyGroupCurrency({
        type: 'object',
        'x-format': 'money-group',
        properties: { a1b2c3d4: { type: 'number' } },
      }),
    ).toBe('USD');
  });
});

describe('setMoneyLineItemAmount', () => {
  it('materializes the currency on the first edit', () => {
    expect(setMoneyLineItemAmount(schema, undefined, 'a1b2c3d4', 1200)).toEqual(
      {
        a1b2c3d4: 1200,
        currency: 'USD',
      },
    );
  });

  it('keeps other line items and never writes a total', () => {
    const value = { a1b2c3d4: 100, currency: 'USD' };

    expect(setMoneyLineItemAmount(schema, value, 'e5f6a7b8', 250)).toEqual({
      a1b2c3d4: 100,
      e5f6a7b8: 250,
      currency: 'USD',
    });
  });

  it('drops the key when the reviewer clears the field', () => {
    const value = { a1b2c3d4: 100, e5f6a7b8: 250, currency: 'USD' };

    expect(setMoneyLineItemAmount(schema, value, 'e5f6a7b8', null)).toEqual({
      a1b2c3d4: 100,
      currency: 'USD',
    });
  });

  it('repairs a malformed stored currency on the next edit', () => {
    expect(
      setMoneyLineItemAmount(schema, { currency: 'nope' }, 'a1b2c3d4', 5),
    ).toEqual({ a1b2c3d4: 5, currency: 'USD' });
  });
});
