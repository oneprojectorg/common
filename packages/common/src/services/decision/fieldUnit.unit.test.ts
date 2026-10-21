import { describe, expect, it } from 'vitest';

import {
  type AmountUnit,
  formatUnitAmount,
  getFieldUnit,
  getUnitLabel,
  isAtMost,
  isSameUnit,
  getFieldAmount,
  sumAmounts,
} from './fieldUnit';
import type { XFormatPropertySchema } from './types';

const USD: AmountUnit = { kind: 'currency', code: 'USD' };
const EUR: AmountUnit = { kind: 'currency', code: 'EUR' };
const DOTS: AmountUnit = { kind: 'custom', label: 'dots' };

const moneyField = (
  extra: Partial<XFormatPropertySchema> = {},
): XFormatPropertySchema => ({
  type: 'object',
  title: 'Budget',
  'x-format': 'money',
  properties: { amount: { type: 'number' } },
  ...extra,
});

const numberField = (
  extra: Partial<XFormatPropertySchema> = {},
): XFormatPropertySchema => ({
  type: 'number',
  title: 'Cost',
  ...extra,
});

describe('getFieldUnit', () => {
  it('reads the currency a money field pins', () => {
    const field = moneyField({
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', const: 'EUR' },
      },
    });

    expect(getFieldUnit(field)).toEqual(EUR);
  });

  it('reads the currency default when a money field pins no const', () => {
    const field = moneyField({
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'CAD' },
      },
    });

    expect(getFieldUnit(field)).toEqual({ kind: 'currency', code: 'CAD' });
  });

  it('falls back to USD for a money field that pins nothing', () => {
    expect(getFieldUnit(moneyField())).toEqual(USD);
  });

  it('ignores x-unit on a money field', () => {
    expect(getFieldUnit(moneyField({ 'x-unit': DOTS }))).toEqual(USD);
  });

  it('reads a custom unit off a numeric field', () => {
    expect(getFieldUnit(numberField({ 'x-unit': DOTS }))).toEqual(DOTS);
  });

  it('reads a currency unit off a numeric field', () => {
    expect(getFieldUnit(numberField({ 'x-unit': EUR }))).toEqual(EUR);
  });

  it('has no unit for a numeric field that declares none', () => {
    expect(getFieldUnit(numberField())).toBeUndefined();
    expect(getFieldUnit(undefined)).toBeUndefined();
  });

  it('has no unit when x-unit names a currency that is not a real code', () => {
    expect(
      getFieldUnit(
        numberField({ 'x-unit': { kind: 'currency', code: 'NOTACODE' } }),
      ),
    ).toBeUndefined();
  });

  it('has no unit when x-unit is structurally malformed', () => {
    expect(
      getFieldUnit(
        numberField({ 'x-unit': { kind: 'custom' } as unknown as AmountUnit }),
      ),
    ).toBeUndefined();
  });
});

describe('getFieldAmount', () => {
  it('resolves a money value whose currency matches the unit', () => {
    expect(
      getFieldAmount({
        value: { amount: 1200, currency: 'EUR' },
        unit: EUR,
      }),
    ).toBe(1200);
  });

  it('compares currency codes case-insensitively', () => {
    expect(
      getFieldAmount({ value: { amount: 5, currency: 'eur' }, unit: EUR }),
    ).toBe(5);
  });

  it('adopts the unit for a value that claims none', () => {
    expect(getFieldAmount({ value: { amount: 40 }, unit: DOTS })).toBe(40);
    expect(getFieldAmount({ value: 750, unit: EUR })).toBe(750);
    expect(getFieldAmount({ value: '750', unit: DOTS })).toBe(750);
    expect(getFieldAmount({ value: 0, unit: DOTS })).toBe(0);
  });

  it('refuses a negative amount', () => {
    expect(getFieldAmount({ value: -5, unit: DOTS })).toBeNull();
    expect(
      getFieldAmount({ value: { amount: -5, currency: 'USD' }, unit: USD }),
    ).toBeNull();
  });

  it('refuses a value stored in a different currency', () => {
    expect(
      getFieldAmount({
        value: { amount: 1200, currency: 'USD' },
        unit: EUR,
      }),
    ).toBe(null);
    expect(
      getFieldAmount({
        value: { amount: 1200, currency: 'USD' },
        unit: DOTS,
      }),
    ).toBe(null);
  });

  it('refuses a value it cannot read as an amount', () => {
    expect(getFieldAmount({ value: undefined, unit: USD })).toBeNull();
    expect(getFieldAmount({ value: null, unit: USD })).toBeNull();
    expect(getFieldAmount({ value: '', unit: USD })).toBeNull();
    expect(getFieldAmount({ value: 'not a number', unit: USD })).toBeNull();
    expect(
      getFieldAmount({ value: { currency: 'USD' }, unit: USD }),
    ).toBeNull();
    expect(
      getFieldAmount({ value: { amount: Number.NaN }, unit: USD }),
    ).toBeNull();
    expect(
      getFieldAmount({
        value: { amount: Number.POSITIVE_INFINITY },
        unit: USD,
      }),
    ).toBeNull();
  });
});

describe('sumAmounts', () => {
  it('sums without float drift', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([300, 450])).toBe(750);
  });

  it('keeps precision finer than a cent', () => {
    expect(sumAmounts([0.004, 0.004, 0.004])).toBe(0.012);
    expect(sumAmounts([12.345, 0.005])).toBe(12.35);
  });

  it('is zero for nothing', () => {
    expect(sumAmounts([])).toBe(0);
  });
});

describe('isAtMost', () => {
  it('compares at the finer of the two precisions', () => {
    expect(isAtMost({ amount: 0.3, limit: 0.3 })).toBe(true);
    expect(isAtMost({ amount: 0.1 + 0.2, limit: 0.3 })).toBe(true);
    expect(isAtMost({ amount: 0.012, limit: 0.01 })).toBe(false);
    expect(isAtMost({ amount: 750, limit: 749 })).toBe(false);
  });
});

describe('isSameUnit', () => {
  it('matches currencies regardless of case', () => {
    expect(isSameUnit(USD, { kind: 'currency', code: 'usd' })).toBe(true);
  });

  it('matches custom labels regardless of surrounding space', () => {
    expect(isSameUnit(DOTS, { kind: 'custom', label: ' dots ' })).toBe(true);
  });

  it('separates different units', () => {
    expect(isSameUnit(USD, EUR)).toBe(false);
    expect(isSameUnit(USD, DOTS)).toBe(false);
    expect(isSameUnit(DOTS, { kind: 'custom', label: 'points' })).toBe(false);
  });
});

describe('formatUnitAmount', () => {
  it('puts a currency symbol before the amount', () => {
    expect(formatUnitAmount({ amount: 750, unit: USD })).toBe('$750');
  });

  it('puts a custom unit after the amount', () => {
    expect(formatUnitAmount({ amount: 12, unit: DOTS })).toBe('12 dots');
  });
});

describe('getUnitLabel', () => {
  it('renders a currency as its symbol', () => {
    expect(getUnitLabel(USD)).toBe('$');
    expect(getUnitLabel(EUR)).toBe('€');
  });

  it('renders an unknown currency code as itself', () => {
    expect(getUnitLabel({ kind: 'currency', code: 'NOTACODE' })).toBe(
      'NOTACODE',
    );
  });

  it('renders a custom unit as its label', () => {
    expect(getUnitLabel(DOTS)).toBe('dots');
  });
});
