import type { AmountUnit } from '@op/types/amountUnit';
import { describe, expect, it } from 'vitest';

import {
  isValidDecisionProcessSchema,
  validateVoteBudget,
  validateVoteSelection,
} from './schemaValidators';

describe('validateVoteBudget', () => {
  const USD: AmountUnit = { kind: 'currency', code: 'USD' };
  const DOTS: AmountUnit = { kind: 'custom', label: 'dots' };

  const costs = (entries: Record<string, number | null>) =>
    new Map(Object.entries(entries));

  const pool = costs({ a: 300, b: 450, unpriced: null });
  const cap = (voterBudget: number) => ({
    voterBudget,
    costs: pool,
    unit: USD,
  });

  it('accepts any ballot when no cap is set', () => {
    expect(validateVoteBudget(['a', 'b'], undefined)).toEqual({
      isValid: true,
      errors: [],
      totalCost: 0,
    });
  });

  it('accepts a ballot under the cap', () => {
    expect(validateVoteBudget(['a'], cap(500)).isValid).toBe(true);
  });

  it('accepts a ballot exactly at the cap', () => {
    expect(validateVoteBudget(['a', 'b'], cap(750)).isValid).toBe(true);
  });

  it('accepts fractional costs that exactly meet the cap', () => {
    expect(
      validateVoteBudget(['a', 'b'], {
        voterBudget: 0.3,
        costs: costs({ a: 0.1, b: 0.2 }),
        unit: USD,
      }).isValid,
    ).toBe(true);
  });

  it('rejects fractional costs that exceed the cap by less than a cent', () => {
    expect(
      validateVoteBudget(['a', 'b', 'c'], {
        voterBudget: 0.01,
        costs: costs({ a: 0.004, b: 0.004, c: 0.004 }),
        unit: DOTS,
      }),
    ).toMatchObject({ isValid: false, totalCost: 0.012 });
  });

  it('rejects a ballot over the cap and names both figures', () => {
    const result = validateVoteBudget(['a', 'b'], cap(700));

    expect(result.isValid).toBe(false);
    expect(result.totalCost).toBe(750);
    expect(result.errors).toEqual([
      'Selected proposals total $750, exceeding the voter budget of $700.',
    ]);
  });

  it('charges nothing for a proposal with no cost', () => {
    expect(validateVoteBudget(['a', 'unpriced'], cap(300))).toMatchObject({
      isValid: true,
      totalCost: 300,
    });
  });

  it('labels a custom unit in the error', () => {
    const dots = { voterBudget: 11, costs: costs({ a: 7, b: 5 }), unit: DOTS };

    expect(validateVoteBudget(['a', 'b'], dots).errors).toEqual([
      'Selected proposals total 12 dots, exceeding the voter budget of 11 dots.',
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
