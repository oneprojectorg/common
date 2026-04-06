import { describe, expect, it } from 'vitest';

import {
  normalizeProposalCategories,
  parseProposalData,
} from './proposalDataSchema';

describe('proposalDataSchema category normalization', () => {
  it('normalizes serialized category arrays into string arrays', () => {
    expect(
      normalizeProposalCategories('["Housing", "Public Transit"]'),
    ).toEqual(['Housing', 'Public Transit']);
  });

  it('falls back to a single category when the string is not JSON', () => {
    expect(normalizeProposalCategories('just one')).toEqual(['just one']);
  });

  it('trims and deduplicates parsed category values', () => {
    expect(
      normalizeProposalCategories('["  alpha ", "beta", "alpha"]'),
    ).toEqual(['alpha', 'beta']);
  });

  it('parses serialized category arrays from proposal data', () => {
    const result = parseProposalData({
      title: 'Serialized categories',
      category: '["Housing", "Public Transit"]',
    });

    expect(result.category).toEqual(['Housing', 'Public Transit']);
  });
});
