import { describe, expect, it } from 'vitest';

import {
  isValidDecisionProcessSchema,
  validateVoteSelection,
} from './schemaValidators';

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
