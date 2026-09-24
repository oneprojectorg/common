import { describe, expect, it } from 'vitest';

import { extractProposalText } from './extractProposalText';

describe('extractProposalText', () => {
  it('collects every string field, including custom template fields', () => {
    expect(
      extractProposalText({
        title: 'A title',
        description: 'A description',
        impact_statement: 'Custom template prose',
        timeline: 'Q3 rollout',
      }),
    ).toBe('A title\n\nA description\n\nCustom template prose\n\nQ3 rollout');
  });

  it('skips known non-prose keys and non-string values', () => {
    expect(
      extractProposalText({
        title: 'A title',
        category: 'environment',
        budget: { amount: 100, currency: 'USD' },
        attachmentIds: ['a', 'b'],
        collaborationDocId: 'doc-1',
        collaborationDocVersionId: 3,
        votes: 12,
      }),
    ).toBe('A title');
  });

  it('drops empty and whitespace-only strings', () => {
    expect(extractProposalText({ title: '  ', description: 'real text' })).toBe(
      'real text',
    );
  });

  it('returns empty for null, arrays, and non-objects', () => {
    expect(extractProposalText(null)).toBe('');
    expect(extractProposalText(undefined)).toBe('');
    expect(extractProposalText(['text'])).toBe('');
    expect(extractProposalText('text')).toBe('');
  });
});
