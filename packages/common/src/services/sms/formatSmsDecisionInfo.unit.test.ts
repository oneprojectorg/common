import { describe, expect, it } from 'vitest';

import { formatSmsDecisionInfo } from './formatSmsDecisionInfo';

describe('formatSmsDecisionInfo', () => {
  it('given a decision in a voting phase, then the text names the phase, says voting is open, counts the proposals and names the next steps', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Park Funding',
        slug: 'park-funding',
        phaseName: 'Voting',
        votingOpen: true,
        proposalCount: 3,
      }),
    ).toBe(
      '"Park Funding" (park-funding): Voting phase, voting open, 3 proposals.\nText VOTE park-funding to register, or PROPOSALS park-funding to browse.',
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

  it('given a name longer than a text line should carry, then the name is clipped and the info line fits one segment', () => {
    const body = formatSmsDecisionInfo({
      name: 'x'.repeat(300),
      slug: 'long-name',
      phaseName: 'Voting',
      votingOpen: true,
      proposalCount: 2,
    });
    const [infoLine] = body.split('\n');

    expect(
      infoLine!.endsWith(
        '..." (long-name): Voting phase, voting open, 2 proposals.',
      ),
    ).toBe(true);
    expect(infoLine!.length).toBeLessThanOrEqual(160);
  });

  it('given a slug as long as a name, then the info line still fits one segment and keeps the whole slug', () => {
    const slug = 'test-instance-'.concat('a'.repeat(36));
    const body = formatSmsDecisionInfo({
      name: 'y'.repeat(300),
      slug,
      phaseName: 'Voting',
      votingOpen: true,
      proposalCount: 2,
    });
    const [infoLine] = body.split('\n');

    expect(infoLine).toContain(`(${slug})`);
    expect(infoLine!.length).toBeLessThanOrEqual(160);
  });
});
