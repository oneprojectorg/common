import { describe, expect, it } from 'vitest';

import type { AmountUnit } from './budgetUnit';
import type { BudgetData } from './proposalDataSchema';
import {
  isValidDecisionProcessSchema,
  validateVoteBudget,
  validateVoteSelection,
} from './schemaValidators';

describe('validateVoteBudget', () => {
  const USD: AmountUnit = { kind: 'currency', code: 'USD' };
  const POINTS: AmountUnit = { kind: 'custom', label: 'points' };

  const costs = (entries: Record<string, BudgetData | null>) =>
    new Map(Object.entries(entries));

  const pool = costs({
    a: { amount: 300 },
    b: { amount: 450 },
    unpriced: null,
    foreign: { amount: 900, currency: 'EUR' },
  });

  it('accepts any ballot when no cap is set', () => {
    const result = validateVoteBudget(['a', 'b'], undefined, pool, USD);

    expect(result).toEqual({ isValid: true, errors: [], totalCost: 750 });
  });

  it('accepts a ballot under the cap', () => {
    expect(validateVoteBudget(['a'], 500, pool, USD).isValid).toBe(true);
  });

  it('accepts a ballot exactly at the cap', () => {
    expect(validateVoteBudget(['a', 'b'], 750, pool, USD).isValid).toBe(true);
  });

  // Floats alone would make this 0.30000000000000004 > 0.3 and reject a
  // ballot that exactly meets its budget.
  it('accepts fractional costs that exactly meet the cap', () => {
    const fractional = costs({ a: { amount: 0.1 }, b: { amount: 0.2 } });

    expect(validateVoteBudget(['a', 'b'], 0.3, fractional, USD).isValid).toBe(
      true,
    );
  });

  it('rejects a ballot over the cap and names both figures', () => {
    const result = validateVoteBudget(['a', 'b'], 700, pool, USD);

    expect(result.isValid).toBe(false);
    expect(result.totalCost).toBe(750);
    expect(result.errors).toEqual([
      'Selected proposals total 750 $, exceeding the voter budget of 700 $.',
    ]);
  });

  it('charges nothing for a proposal with no budget', () => {
    expect(validateVoteBudget(['a', 'unpriced'], 300, pool, USD)).toMatchObject(
      { isValid: true, totalCost: 300 },
    );
  });

  // A value left over from a different unit is unresolvable, not free money
  // the voter is charged for.
  it('charges nothing for a budget stored in another unit', () => {
    expect(validateVoteBudget(['a', 'foreign'], 300, pool, USD)).toMatchObject({
      isValid: true,
      totalCost: 300,
    });
  });

  it('enforces a custom unit the same way, and labels it', () => {
    const points = costs({ a: { amount: 7 }, b: { amount: 5 } });

    expect(validateVoteBudget(['a', 'b'], 12, points, POINTS).isValid).toBe(
      true,
    );
    expect(validateVoteBudget(['a', 'b'], 11, points, POINTS).errors).toEqual([
      'Selected proposals total 12 points, exceeding the voter budget of 11 points.',
    ]);
  });
});

describe('validateVoteSelection', () => {
  const available = ['a', 'b', 'c', 'd', 'e'];

  it('accepts selection within cap', () => {
    const result = validateVoteSelection(['a', 'b'], 2, available);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects selection exceeding cap', () => {
    const result = validateVoteSelection(['a', 'b', 'c'], 2, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(['Cannot select more than 2 proposals']);
  });

  it('accepts selection equal to cap', () => {
    const result = validateVoteSelection(['a', 'b'], 2, available);
    expect(result.isValid).toBe(true);
  });

  it('treats undefined cap as unlimited', () => {
    const result = validateVoteSelection(
      ['a', 'b', 'c', 'd', 'e'],
      undefined,
      available,
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('still requires at least one selection when cap is undefined', () => {
    const result = validateVoteSelection([], undefined, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(['At least one proposal must be selected']);
  });

  it('still requires at least one selection when cap is defined', () => {
    const result = validateVoteSelection([], 5, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(['At least one proposal must be selected']);
  });

  it('rejects ineligible proposal ids regardless of cap', () => {
    const result = validateVoteSelection(['a', 'zzz'], undefined, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(['Invalid proposal IDs: zzz']);
  });

  it('rejects duplicates regardless of cap', () => {
    const result = validateVoteSelection(['a', 'a'], undefined, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(['Duplicate proposal IDs: a']);
  });

  it('reports over-cap and duplicate errors together', () => {
    const result = validateVoteSelection(['a', 'a', 'a'], 2, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Cannot select more than 2 proposals');
    expect(result.errors).toContain('Duplicate proposal IDs: a, a');
  });

  it('reports over-cap and ineligible errors together', () => {
    const result = validateVoteSelection(['a', 'b', 'zzz'], 2, available);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Cannot select more than 2 proposals');
    expect(result.errors).toContain('Invalid proposal IDs: zzz');
  });
});

describe('isValidDecisionProcessSchema', () => {
  const base = {
    allowProposals: true,
    allowDecisions: true,
    instanceData: {} as Record<string, unknown>,
  };

  it('accepts schema without maxVotesPerMember', () => {
    expect(isValidDecisionProcessSchema(base)).toBe(true);
  });

  it('accepts schema with valid positive integer maxVotesPerMember', () => {
    expect(
      isValidDecisionProcessSchema({
        ...base,
        instanceData: { maxVotesPerMember: 5 },
      }),
    ).toBe(true);
  });

  it('rejects string maxVotesPerMember (no coercion)', () => {
    expect(
      isValidDecisionProcessSchema({
        ...base,
        instanceData: { maxVotesPerMember: '5' },
      }),
    ).toBe(false);
  });

  it('rejects zero maxVotesPerMember', () => {
    expect(
      isValidDecisionProcessSchema({
        ...base,
        instanceData: { maxVotesPerMember: 0 },
      }),
    ).toBe(false);
  });

  it('rejects negative maxVotesPerMember', () => {
    expect(
      isValidDecisionProcessSchema({
        ...base,
        instanceData: { maxVotesPerMember: -1 },
      }),
    ).toBe(false);
  });

  it('rejects non-integer maxVotesPerMember', () => {
    expect(
      isValidDecisionProcessSchema({
        ...base,
        instanceData: { maxVotesPerMember: 2.5 },
      }),
    ).toBe(false);
  });

  it('rejects missing allowDecisions', () => {
    expect(
      isValidDecisionProcessSchema({
        allowProposals: true,
        instanceData: {},
      }),
    ).toBe(false);
  });

  it('rejects null input', () => {
    expect(isValidDecisionProcessSchema(null)).toBe(false);
  });
});
