import { describe, expect, it } from 'vitest';

import {
  getCurrencySymbol,
  getMoneyAmount,
  getMoneyCurrency,
  isValidCurrencyCode,
} from './money';

describe('money value readers', () => {
  it('reads a well-formed value', () => {
    expect(getMoneyAmount({ amount: 1200.5, currency: 'USD' })).toBe(1200.5);
    expect(getMoneyCurrency({ amount: 1, currency: 'eur' })).toBe('eur');
  });

  it('tolerates partial / malformed shapes', () => {
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
      expect(getMoneyAmount(value)).toBeNull();
    }
    expect(getMoneyCurrency({ amount: 1, currency: 'US$' })).toBeUndefined();
    expect(getMoneyCurrency({ amount: 1 })).toBeUndefined();
  });
});

describe('isValidCurrencyCode', () => {
  it('accepts ISO 4217 codes from the Intl registry, any case', () => {
    expect(isValidCurrencyCode('USD')).toBe(true);
    expect(isValidCurrencyCode('usd')).toBe(true);
    expect(isValidCurrencyCode('EUR')).toBe(true);
  });

  it('rejects non-codes', () => {
    expect(isValidCurrencyCode('US')).toBe(false);
    expect(isValidCurrencyCode('US$')).toBe(false);
    expect(isValidCurrencyCode('DOLLARS')).toBe(false);
    expect(isValidCurrencyCode(12)).toBe(false);
  });
});

describe('getCurrencySymbol', () => {
  it('returns the narrow symbol, falling back to the code', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
  });

  it('returns malformed persisted codes verbatim instead of throwing', () => {
    expect(getCurrencySymbol('BOGUS')).toBe('BOGUS');
    expect(getCurrencySymbol('')).toBe('');
  });
});
