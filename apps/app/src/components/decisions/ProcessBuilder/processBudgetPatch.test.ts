import { describe, expect, it } from 'vitest';

import { isSavableProcessBudget } from './processBudgetPatch';

describe('isSavableProcessBudget', () => {
  it('accepts a cleared budget and a positive amount', () => {
    expect(isSavableProcessBudget(null)).toBe(true);
    expect(isSavableProcessBudget(25000)).toBe(true);
    expect(isSavableProcessBudget(0.5)).toBe(true);
  });

  it('refuses zero, negative and non-finite amounts so they never replace a saved budget', () => {
    expect(isSavableProcessBudget(0)).toBe(false);
    expect(isSavableProcessBudget(-5)).toBe(false);
    expect(isSavableProcessBudget(Number.NaN)).toBe(false);
    expect(isSavableProcessBudget(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
