import { describe, expect, it } from 'vitest';

import {
  type AmountUnit,
  getFieldUnit,
  getTemplateBudgetUnit,
  getUnitLabel,
  isSameUnit,
  normalizeBudgetForTemplate,
  resolveUnitAmount,
  toFixedPointUnits,
} from './budgetUnit';
import type { ProposalTemplateSchema, XFormatPropertySchema } from './types';

const USD: AmountUnit = { kind: 'currency', code: 'USD' };
const EUR: AmountUnit = { kind: 'currency', code: 'EUR' };
const POINTS: AmountUnit = { kind: 'custom', label: 'points' };

const moneyField = (
  extra: Partial<XFormatPropertySchema> = {},
): XFormatPropertySchema => ({
  type: 'object',
  title: 'Budget',
  'x-format': 'money',
  properties: { amount: { type: 'number' } },
  ...extra,
});

const templateWithBudget = (
  field: XFormatPropertySchema,
): ProposalTemplateSchema => ({
  type: 'object',
  properties: { budget: field },
});

describe('getFieldUnit', () => {
  it('reads a currency unit off x-unit', () => {
    expect(getFieldUnit(moneyField({ 'x-unit': EUR }))).toEqual(EUR);
  });

  it('reads a custom unit off x-unit', () => {
    expect(getFieldUnit(moneyField({ 'x-unit': POINTS }))).toEqual(POINTS);
  });

  it('prefers x-unit over a currency the template still pins', () => {
    const field = moneyField({
      'x-unit': POINTS,
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', const: 'USD' },
      },
    });

    expect(getFieldUnit(field)).toEqual(POINTS);
  });

  it('falls back to the pinned currency const when there is no x-unit', () => {
    const field = moneyField({
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', const: 'EUR' },
      },
    });

    expect(getFieldUnit(field)).toEqual(EUR);
  });

  it('falls back to the pinned currency default when there is no const', () => {
    const field = moneyField({
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'CAD' },
      },
    });

    expect(getFieldUnit(field)).toEqual({ kind: 'currency', code: 'CAD' });
  });

  it('falls back to USD when the template pins nothing', () => {
    expect(getFieldUnit(moneyField())).toEqual(USD);
    expect(getFieldUnit(undefined)).toEqual(USD);
  });

  // A unit nothing can render would otherwise silently count amounts in it.
  it('falls back to USD when x-unit names a currency that is not a real code', () => {
    const field = moneyField({
      'x-unit': { kind: 'currency', code: 'NOTACODE' },
    });

    expect(getFieldUnit(field)).toEqual(USD);
  });

  it('falls back to USD when x-unit is structurally malformed', () => {
    // Templates are author-supplied JSON, so the stored value is not
    // guaranteed to match the declared type.
    const field = moneyField({
      'x-unit': { kind: 'custom' } as unknown as AmountUnit,
    });

    expect(getFieldUnit(field)).toEqual(USD);
  });
});

describe('getTemplateBudgetUnit', () => {
  it('reads the unit of the template’s budget field', () => {
    expect(
      getTemplateBudgetUnit(templateWithBudget(moneyField({ 'x-unit': EUR }))),
    ).toEqual(EUR);
  });

  it('is undefined when the template collects no budget', () => {
    expect(
      getTemplateBudgetUnit({ type: 'object', properties: {} }),
    ).toBeUndefined();
    expect(getTemplateBudgetUnit(null)).toBeUndefined();
    expect(getTemplateBudgetUnit(undefined)).toBeUndefined();
  });
});

describe('resolveUnitAmount', () => {
  it('resolves a value whose currency matches the unit', () => {
    expect(resolveUnitAmount({ amount: 1200, currency: 'EUR' }, EUR)).toEqual({
      amount: 1200,
      unit: EUR,
    });
  });

  it('compares currency codes case-insensitively', () => {
    expect(resolveUnitAmount({ amount: 5, currency: 'eur' }, EUR)).toEqual({
      amount: 5,
      unit: EUR,
    });
  });

  it('adopts the unit for a value that claims none', () => {
    expect(resolveUnitAmount({ amount: 40 }, POINTS)).toEqual({
      amount: 40,
      unit: POINTS,
    });
  });

  it('adopts the unit for a legacy plain number', () => {
    expect(resolveUnitAmount(750, EUR)).toEqual({ amount: 750, unit: EUR });
    expect(resolveUnitAmount('750', POINTS)).toEqual({
      amount: 750,
      unit: POINTS,
    });
  });

  it('refuses a value stored in a different currency', () => {
    expect(
      resolveUnitAmount({ amount: 1200, currency: 'USD' }, EUR),
    ).toBeNull();
  });

  // Left over from a template that has since moved off currency — recounting
  // the number as points would invent a cost nobody entered.
  it('refuses a currency-stamped value under a custom unit', () => {
    expect(
      resolveUnitAmount({ amount: 1200, currency: 'USD' }, POINTS),
    ).toBeNull();
  });

  it('refuses a value it cannot read as an amount', () => {
    expect(resolveUnitAmount(undefined, USD)).toBeNull();
    expect(resolveUnitAmount(null, USD)).toBeNull();
    expect(resolveUnitAmount('not a budget', USD)).toBeNull();
    expect(resolveUnitAmount({ currency: 'USD' }, USD)).toBeNull();
    expect(resolveUnitAmount({ amount: Number.NaN }, USD)).toBeNull();
    expect(
      resolveUnitAmount({ amount: Number.POSITIVE_INFINITY }, USD),
    ).toBeNull();
  });
});

describe('toFixedPointUnits', () => {
  // The reason it exists: 0.1 + 0.2 > 0.3 in floats would reject a ballot
  // that exactly meets its budget.
  it('sums without float drift', () => {
    expect(toFixedPointUnits(0.1) + toFixedPointUnits(0.2)).toBe(
      toFixedPointUnits(0.3),
    );
  });

  it('rounds to two decimals', () => {
    expect(toFixedPointUnits(12.345)).toBe(1235);
    expect(toFixedPointUnits(0)).toBe(0);
  });
});

describe('isSameUnit', () => {
  it('matches currencies regardless of case', () => {
    expect(isSameUnit(USD, { kind: 'currency', code: 'usd' })).toBe(true);
  });

  it('matches custom labels regardless of surrounding space', () => {
    expect(isSameUnit(POINTS, { kind: 'custom', label: ' points ' })).toBe(
      true,
    );
  });

  it('separates different units', () => {
    expect(isSameUnit(USD, EUR)).toBe(false);
    expect(isSameUnit(USD, POINTS)).toBe(false);
    expect(isSameUnit(POINTS, { kind: 'custom', label: 'dots' })).toBe(false);
  });
});

describe('normalizeBudgetForTemplate', () => {
  it('stamps the currency in for a currency-kind template', () => {
    expect(
      normalizeBudgetForTemplate(
        { amount: 90 },
        templateWithBudget(moneyField({ 'x-unit': EUR })),
      ),
    ).toEqual({ amount: 90, currency: 'EUR' });
  });

  it('leaves an already-qualified value alone', () => {
    expect(
      normalizeBudgetForTemplate(
        { amount: 90, currency: 'USD' },
        templateWithBudget(moneyField({ 'x-unit': EUR })),
      ),
    ).toEqual({ amount: 90, currency: 'USD' });
  });

  it('drops a leftover currency for a custom-kind template', () => {
    expect(
      normalizeBudgetForTemplate(
        { amount: 90, currency: 'USD' },
        templateWithBudget(moneyField({ 'x-unit': POINTS })),
      ),
    ).toEqual({ amount: 90 });
  });

  it('passes through when there is nothing to reshape', () => {
    const template = templateWithBudget(moneyField({ 'x-unit': EUR }));

    expect(normalizeBudgetForTemplate(null, template)).toBeNull();
    expect(normalizeBudgetForTemplate(undefined, template)).toBeUndefined();
    expect(
      normalizeBudgetForTemplate(
        { amount: 5 },
        {
          type: 'object',
          properties: {},
        },
      ),
    ).toEqual({ amount: 5 });
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
    expect(getUnitLabel(POINTS)).toBe('points');
  });
});
