import { describe, expect, it } from 'vitest';

import { formatSmsDecisionList } from './formatSmsDecisionList';

describe('formatSmsDecisionList', () => {
  it('given no decisions, when formatted, then it says so', () => {
    expect(formatSmsDecisionList([])).toBe(
      'You are not a participant in any decision yet.',
    );
  });

  it('given decisions, when formatted, then each is one line with its slug and voting is marked where open', () => {
    expect(
      formatSmsDecisionList([
        { name: 'Park Funding', slug: 'park-funding', votingOpen: true },
        { name: 'Bike Lanes', slug: 'bike-lanes', votingOpen: false },
      ]),
    ).toBe(
      [
        'Your decisions:',
        'Park Funding (voting open) - VOTE park-funding',
        'Bike Lanes - VOTE bike-lanes',
      ].join('\n'),
    );
  });

  it('given more decisions than fit, when formatted, then the first ten are listed and the rest are counted', () => {
    const decisions = Array.from({ length: 12 }, (_, i) => ({
      name: `Decision ${i + 1}`,
      slug: `decision-${i + 1}`,
      votingOpen: false,
    }));

    const lines = formatSmsDecisionList(decisions).split('\n');

    expect(lines).toHaveLength(12);
    expect(lines[10]).toBe('Decision 10 - VOTE decision-10');
    expect(lines.at(-1)).toBe('and 2 more');
  });
});
