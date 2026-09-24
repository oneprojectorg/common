import { describe, expect, it } from 'vitest';

import { resolveBudgetOverride } from './proposalListPreview';

describe('resolveBudgetOverride', () => {
  it('keeps the snapshot budget when a legacy numeric field resolves the ambiguous zero sentinel', () => {
    expect(resolveBudgetOverride(0, { amount: 5000, currency: 'USD' })).toEqual(
      { amount: 5000, currency: 'USD' },
    );
  });

  it('resolves to undefined for an ambiguous zero with no snapshot to fall back to', () => {
    expect(resolveBudgetOverride(0, null)).toBeUndefined();
    expect(resolveBudgetOverride(0, undefined)).toBeUndefined();
  });

  it('keeps the snapshot currency when a legacy numeric field resolves a new amount', () => {
    expect(
      resolveBudgetOverride(500, { amount: 100, currency: 'EUR' }),
    ).toEqual({ amount: 500, currency: 'EUR' });
  });

  it('defaults to USD for a nonzero numeric override with no snapshot currency to preserve', () => {
    expect(resolveBudgetOverride(500, null)).toEqual({
      amount: 500,
      currency: 'USD',
    });
  });

  it('prefers a canonical money object over the snapshot', () => {
    expect(
      resolveBudgetOverride(
        { amount: 5000, currency: 'CAD' },
        { amount: 100, currency: 'USD' },
      ),
    ).toEqual({ amount: 5000, currency: 'CAD' });
  });

  it('falls back to the snapshot when the raw value normalizes to nothing', () => {
    expect(
      resolveBudgetOverride('not a budget', { amount: 100, currency: 'USD' }),
    ).toEqual({ amount: 100, currency: 'USD' });
    expect(
      resolveBudgetOverride(null, { amount: 100, currency: 'USD' }),
    ).toEqual({ amount: 100, currency: 'USD' });
  });

  it('resolves to undefined when neither the raw value nor the snapshot has a budget', () => {
    expect(resolveBudgetOverride(null, null)).toBeUndefined();
    expect(resolveBudgetOverride(undefined, undefined)).toBeUndefined();
  });
});
