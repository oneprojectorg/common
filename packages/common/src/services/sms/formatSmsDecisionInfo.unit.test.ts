import { describe, expect, it } from 'vitest';

import { formatSmsDecisionInfo } from './formatSmsDecisionInfo';

describe('formatSmsDecisionInfo', () => {
  it('given a decision in a voting phase, then one text names the phase, says voting is open and counts the proposals', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Park Funding',
        phaseName: 'Voting',
        votingOpen: true,
        proposalCount: 3,
      }),
    ).toBe('"Park Funding": Voting phase, voting open, 3 proposals.');
  });

  it('given one proposal and voting closed, then the count is singular and voting is reported closed', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Bike Lanes',
        phaseName: 'Submission',
        votingOpen: false,
        proposalCount: 1,
      }),
    ).toBe('"Bike Lanes": Submission phase, voting closed, 1 proposal.');
  });

  it('given no current phase, then the text says so instead of naming one', () => {
    expect(
      formatSmsDecisionInfo({
        name: 'Bike Lanes',
        phaseName: null,
        votingOpen: false,
        proposalCount: 0,
      }),
    ).toBe('"Bike Lanes": no phase open, voting closed, 0 proposals.');
  });

  it('given a name longer than a text line should carry, then the name is clipped and the rest of the text survives', () => {
    const body = formatSmsDecisionInfo({
      name: 'x'.repeat(300),
      phaseName: 'Voting',
      votingOpen: true,
      proposalCount: 2,
    });

    expect(body.endsWith('...": Voting phase, voting open, 2 proposals.')).toBe(
      true,
    );
    expect(body.length).toBeLessThan(160);
  });
});
