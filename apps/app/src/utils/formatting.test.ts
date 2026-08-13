import { describe, expect, it, vi } from 'vitest';

import { formatAmount, formatMoney, getCurrencySymbol } from './formatting';

describe('formatMoney', () => {
  it('renders whole amounts without decimals and fractional ones with them', () => {
    // The pair the shared formatter cache is keyed on. A single formatter for
    // both would either print "$5,000.00" on every card or round $5,000.50 to
    // "$5,001".
    expect(formatMoney({ amount: 5000, currency: 'USD' })).toBe('$5,000');
    expect(formatMoney({ amount: 5000.5, currency: 'USD' })).toBe('$5,000.50');
  });

  it("takes each currency's own decimal count for fractional amounts", () => {
    // Nothing pins the fraction digits on the currency branch, so `Intl`
    // applies the currency's own — JPY has none.
    expect(formatMoney({ amount: 1000.5, currency: 'JPY' })).toBe('¥1,001');
    expect(formatMoney({ amount: 5000, currency: 'EUR' })).toBe('€5,000');
  });

  it('falls back to an unlabeled amount for a currency `Intl` rejects', () => {
    // `Intl.NumberFormat` throws `RangeError` at *construction* on a malformed
    // code, and a budget's currency is only typed as a string all the way from
    // the database — so an imported record must not blank the page it renders
    // on into an error boundary.
    expect(formatMoney({ amount: 5000, currency: 'not-a-code' })).toBe('5,000');
  });

  it('caches the fallback under the bad code, so it is built once', () => {
    // Counting constructions rather than comparing the two return values: the
    // output is deterministic either way, so an assertion on it passes with the
    // cache torn out. What has to hold is that the *throwing* constructor is
    // not re-entered — an uncached failure re-runs it on every render of every
    // row holding the bad code, and it is also what keeps the invalid-currency
    // warning to one per code instead of one per row.
    const first = formatMoney({ amount: 1234.5, currency: '!!' });
    expect(first).toBe('1,234.50');

    const spy = vi.spyOn(Intl, 'NumberFormat');
    try {
      expect(formatMoney({ amount: 1234.5, currency: '!!' })).toBe(first);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('formatAmount', () => {
  it('groups like `formatMoney` but without a currency marker', () => {
    expect(formatAmount(1000000)).toBe('1,000,000');
  });

  it('pads a fractional amount to two places', () => {
    // It sits directly beside a formatted budget ("Max 1,000.50" above a field
    // whose value renders as "$1,000.50"), so a bare `Intl` default of 0–3
    // decimals would show two conventions for the same number in one control.
    expect(formatAmount(1000.5)).toBe('1,000.50');
    expect(formatAmount(5000.567)).toBe('5,000.57');
  });
});

describe('getCurrencySymbol', () => {
  it('returns the symbol a currency formats with', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
  });

  it('keeps codes distinguishable rather than collapsing them to "$"', () => {
    // The default `currencyDisplay: 'symbol'`, not `'narrowSymbol'` — narrow
    // renders CAD, AUD, SGD and MXN all as a bare `$`, so a currency picker
    // would list four identical-looking entries.
    expect(getCurrencySymbol('CAD')).toBe('CA$');
  });

  it('falls back to the code itself when `Intl` rejects it', () => {
    // The fallback formatter is unlabeled, so there is no currency part to
    // find — without this the input would render with no marker at all.
    expect(getCurrencySymbol('not-a-code')).toBe('not-a-code');
  });
});
