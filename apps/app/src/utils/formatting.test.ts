import { describe, expect, it } from 'vitest';

import { formatAwardedAmount } from './formatting';

describe('formatAwardedAmount', () => {
  it.each([
    [20000, 'USD', '$20K'],
    [1000, 'USD', '$1K'],
    [4000, 'EUR', '€4K'],
  ])('shortens whole thousands: %s %s → %s', (amount, currency, expected) => {
    expect(formatAwardedAmount({ amount, currency })).toBe(expected);
  });

  it.each([
    [20500, '$20,500'],
    [999, '$999'],
    [1000.5, '$1,000.5'],
  ])('keeps the full amount otherwise: %s → %s', (amount, expected) => {
    expect(formatAwardedAmount({ amount, currency: 'USD' })).toBe(expected);
  });
});
