import { describe, expect, it } from 'vitest';

import { formatSmsDecisionInfo } from './formatSmsDecisionInfo';

describe('formatSmsDecisionInfo', () => {
  it('given a decision in a voting phase, then one text names the phase, says voting is open and counts the proposals', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Park Funding',
        slug: 'park-funding',
        phaseName: 'Voting',
        votingOpen: true,
        proposalCount: 3,
      }),
    ).toBe(
      '"Park Funding" (park-funding): Voting phase, voting open, 3 proposals.',
    );
  });

  it('given one proposal and voting closed, then the count is singular and voting is reported closed', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Bike Lanes',
        slug: 'bike-lanes',
        phaseName: 'Submission',
        votingOpen: false,
        proposalCount: 1,
      }),
    ).toBe(
      '"Bike Lanes" (bike-lanes): Submission phase, voting closed, 1 proposal.',
    );
  });

  it('given no current phase, then the text says so instead of naming one', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Bike Lanes',
        slug: 'bike-lanes',
        phaseName: null,
        votingOpen: false,
        proposalCount: 0,
      }),
    ).toBe(
      '"Bike Lanes" (bike-lanes): no phase open, voting closed, 0 proposals.',
    );
  });

  it('given a name longer than a text line should carry, then the name is clipped and the rest of the text survives', () => {
    const body = formatSmsDecisionInfo({
      name: 'x'.repeat(300),
      slug: 'long-name',
      phaseName: 'Voting',
      votingOpen: true,
      proposalCount: 2,
    });

    expect(
      body.endsWith(
        '..." (long-name): Voting phase, voting open, 2 proposals.',
      ),
    ).toBe(true);
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it('given a slug as long as a name, then the text still fits one segment and keeps the whole slug', () => {
    const slug = 'test-instance-'.concat('a'.repeat(36));
    const body = formatSmsDecisionInfo({
      name: 'y'.repeat(300),
      slug,
      phaseName: 'Voting',
      votingOpen: true,
      proposalCount: 2,
    });

    expect(body).toContain(`(${slug})`);
    expect(body.length).toBeLessThanOrEqual(160);
  });
});
