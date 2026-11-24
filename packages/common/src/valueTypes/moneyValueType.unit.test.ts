import { describe, expect, it } from 'vitest';

import { moneyValueType } from './moneyValueType';

const usd = (amount: number) => ({ amount, currency: 'USD' });

describe('moneyValueType', () => {
  it('parses an amount with a currency', () => {
    expect(moneyValueType.parse(usd(50322.58))).toEqual(usd(50322.58));
  });

  it.each([
    { amount: '1,000', currency: 'USD' },
    { amount: '$500', currency: 'USD' },
    { amount: null, currency: 'USD' },
    { amount: Infinity, currency: 'USD' },
    { amount: 100, currency: 'USD', note: 'estimate' },
    { amount: 100 },
    100,
    null,
  ])('does not parse %j', (value) => {
    expect(moneyValueType.parse(value)).toBeUndefined();
  });

  it('adds two amounts of one currency without float noise', () => {
    expect(moneyValueType.add(usd(0.1), usd(0.2))).toEqual(usd(0.3));
  });

  it('cannot add two currencies', () => {
    expect(
      moneyValueType.add(usd(100), { amount: 100, currency: 'EUR' }),
    ).toBeUndefined();
  });
});
