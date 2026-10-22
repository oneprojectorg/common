import { describe, expect, it } from 'vitest';

import { formatSmsDecisionList } from './formatSmsDecisionList';
import { SMS_MAX_BODY_LENGTH } from './text';

describe('formatSmsDecisionList', () => {
  it('given no decisions, when formatted, then it says so', () => {
    expect(formatSmsDecisionList([])).toEqual([
      'You are not a participant in any decision yet.',
    ]);
  });

  it('given decisions, when formatted, then each is one line with its slug and voting is marked where open', () => {
    expect(
      formatSmsDecisionList([
        { name: 'Park Funding', slug: 'park-funding', votingOpen: true },
        { name: 'Bike Lanes', slug: 'bike-lanes', votingOpen: false },
      ]),
    ).toEqual([
      [
        'Your decisions:',
        'Park Funding (voting open) - SHOW park-funding',
        'Bike Lanes - SHOW bike-lanes',
      ].join('\n'),
    ]);
  });

  it('given ten decisions with names and slugs as long as they can be, then every text fits and every line keeps its slug', () => {
    const decisions = Array.from({ length: 10 }, (_, i) => ({
      name: `Decision ${i + 1} `.padEnd(256, 'x'),
      slug: `decision-${i + 1}-`.padEnd(256, 'y'),
      votingOpen: i % 2 === 0,
    }));

    const bodies = formatSmsDecisionList(decisions);

    expect(bodies.length).toBeGreaterThan(1);
    bodies.forEach((body) => {
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    });
    const joined = bodies.join('\n');
    decisions.forEach((decision) => {
      expect(joined).toContain(`SHOW ${decision.slug}`);
    });
  });

  it('given more decisions than fit, when formatted, then the first ten are listed and the rest are counted', () => {
    const decisions = Array.from({ length: 12 }, (_, i) => ({
      name: `Decision ${i + 1}`,
      slug: `decision-${i + 1}`,
      votingOpen: false,
    }));

    const [body, ...rest] = formatSmsDecisionList(decisions);
    const lines = body!.split('\n');

    expect(rest).toEqual([]);
    expect(lines).toHaveLength(12);
    expect(lines[10]).toBe('Decision 10 - SHOW decision-10');
    expect(lines.at(-1)).toBe('and 2 more');
  });
});
