import { describe, expect, it } from 'vitest';

import type { AmountUnit } from './budgetUnit';
import type { BudgetData } from './proposalDataSchema';
import {
  canAffordProposal,
  getProposalCost,
  sumSelectedCost,
} from './voteBudget';

const USD: AmountUnit = { kind: 'currency', code: 'USD' };
const POINTS: AmountUnit = { kind: 'custom', label: 'points' };

const costs = (entries: Record<string, BudgetData | null>) =>
  new Map(Object.entries(entries));

describe('getProposalCost', () => {
  it('prices a budget stored in the unit', () => {
    expect(getProposalCost({ amount: 900, currency: 'USD' }, USD)).toBe(900);
    expect(getProposalCost({ amount: 12 }, POINTS)).toBe(12);
  });

  // A misconfigured budget field must not make a proposal unvotable.
  it('prices anything it cannot read as free', () => {
    expect(getProposalCost(null, USD)).toBe(0);
    expect(getProposalCost(undefined, USD)).toBe(0);
    expect(getProposalCost({ amount: 900, currency: 'EUR' }, USD)).toBe(0);
    expect(getProposalCost({ amount: 900, currency: 'USD' }, POINTS)).toBe(0);
  });
});

describe('sumSelectedCost', () => {
  it('sums the selection', () => {
    expect(
      sumSelectedCost(
        ['a', 'b'],
        costs({ a: { amount: 300 }, b: { amount: 450 }, c: { amount: 999 } }),
        USD,
      ),
    ).toBe(750);
  });

  it('counts a proposal with no resolvable budget as free', () => {
    expect(
      sumSelectedCost(
        ['a', 'b', 'missing'],
        costs({ a: { amount: 300 }, b: null }),
        USD,
      ),
    ).toBe(300);
  });

  it('is zero for an empty selection', () => {
    expect(sumSelectedCost([], costs({ a: { amount: 300 } }), USD)).toBe(0);
  });

  // The float-drift case the fixed-point arithmetic exists for.
  it('sums fractional amounts exactly', () => {
    expect(
      sumSelectedCost(
        ['a', 'b'],
        costs({ a: { amount: 0.1 }, b: { amount: 0.2 } }),
        USD,
      ),
    ).toBe(0.3);
  });
});

describe('canAffordProposal', () => {
  const pool = costs({
    a: { amount: 300 },
    b: { amount: 450 },
    c: { amount: 0.2 },
    free: null,
  });

  it('allows a selection that fits', () => {
    expect(canAffordProposal('b', ['a'], pool, USD, 1000)).toBe(true);
  });

  it('allows a selection that exactly meets the budget', () => {
    expect(canAffordProposal('b', ['a'], pool, USD, 750)).toBe(true);
    expect(
      canAffordProposal('c', ['c'], costs({ c: { amount: 0.1 } }), USD, 0.1),
    ).toBe(true);
  });

  it('refuses a selection that overruns the budget', () => {
    expect(canAffordProposal('b', ['a'], pool, USD, 749)).toBe(false);
  });

  // Re-asking about something already selected answers "does it still fit",
  // not "can I afford it twice".
  it('counts an already-selected proposal once', () => {
    expect(canAffordProposal('a', ['a'], pool, USD, 300)).toBe(true);
  });

  it('always allows a proposal with no resolvable budget', () => {
    expect(canAffordProposal('free', ['a', 'b'], pool, USD, 750)).toBe(true);
  });
});
