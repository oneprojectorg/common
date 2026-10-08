import { describe, expect, it } from 'vitest';

import {
  formatSmsBallot,
  formatSmsBallotWelcome,
  formatSmsCost,
  formatSmsPickConfirmation,
  formatSmsProposalInfo,
  formatSmsProposalPage,
} from './smsBallotFormat';

const proposal = (
  code: string,
  title: string,
  cost: number | null,
  summary: string | null = null,
) => ({
  code,
  proposalId: `id-${code}`,
  title,
  cost,
  currency: 'USD',
  summary,
});

describe('formatSmsCost', () => {
  it('formats whole dollars with a thousands separator and no cents', () => {
    expect(formatSmsCost(85_000, 'USD')).toBe('$85,000');
    expect(formatSmsCost(null, 'USD')).toBe('');
  });
});

describe('formatSmsProposalPage', () => {
  const proposals = Array.from({ length: 7 }, (_, i) =>
    proposal(String(101 + i), `Proposal ${i + 1}`, (i + 1) * 10_000),
  );

  it('given the first page, then it counts the proposals and asks for MORE', () => {
    const { body, hasMore } = formatSmsProposalPage({
      decisionName: 'Park',
      proposals,
      page: 0,
    });
    expect(hasMore).toBe(true);
    expect(body.split('\n')).toEqual([
      '"Park" has 7 proposals. First 5:',
      '101 Proposal 1 $10k',
      '102 Proposal 2 $20k',
      '103 Proposal 3 $30k',
      '104 Proposal 4 $40k',
      '105 Proposal 5 $50k',
      'Reply MORE for the next ones, or INFO plus a code.',
    ]);
  });

  it('given the last page, then it invites a pick', () => {
    const { body, hasMore } = formatSmsProposalPage({
      decisionName: 'Park',
      proposals,
      page: 1,
    });
    expect(hasMore).toBe(false);
    expect(body.split('\n')).toEqual([
      'Next 2:',
      '106 Proposal 6 $60k',
      '107 Proposal 7 $70k',
      'Text a code to add it to your ballot, or INFO plus a code.',
    ]);
  });

  it('given a proposal with no cost, then its line omits the amount', () => {
    const { body } = formatSmsProposalPage({
      decisionName: 'Park',
      proposals: [proposal('101', 'Free idea', null)],
      page: 0,
    });
    expect(body).toContain('101 Free idea\n');
  });
});

describe('formatSmsProposalInfo', () => {
  it('includes the summary when there is one', () => {
    expect(
      formatSmsProposalInfo(
        proposal('218', 'Bike lane', 310_000, 'A curb-protected lane.'),
      ),
    ).toBe(
      '218: "Bike lane" ($310,000). A curb-protected lane. Text 218 to add it to your ballot.',
    );
    expect(formatSmsProposalInfo(proposal('218', 'Bike lane', null))).toBe(
      '218: "Bike lane". Text 218 to add it to your ballot.',
    );
  });
});

describe('formatSmsBallotWelcome', () => {
  it('given one proposal, then it asks for YES', () => {
    expect(
      formatSmsBallotWelcome({
        decisionName: 'Park',
        proposals: [proposal('101', 'Lights', 85_000)],
        maxVotesPerMember: 1,
      }),
    ).toBe(
      'Voting is open for "Park". Reply YES to vote for "Lights" ($85,000).',
    );
  });

  it('given several proposals, then it states the limit', () => {
    const proposals = [proposal('101', 'A', 1), proposal('102', 'B', 2)];
    expect(
      formatSmsBallotWelcome({
        decisionName: 'Park',
        proposals,
        maxVotesPerMember: 1,
      }),
    ).toContain('You can pick up to 1 proposal.');
    expect(
      formatSmsBallotWelcome({
        decisionName: 'Park',
        proposals,
        maxVotesPerMember: 3,
      }),
    ).toContain('You can pick up to 3 proposals.');
    expect(
      formatSmsBallotWelcome({
        decisionName: 'Park',
        proposals,
        maxVotesPerMember: null,
      }),
    ).toContain('as many proposals as you like');
  });
});

describe('formatSmsPickConfirmation', () => {
  it('confirms each pick with its rank and the picks left', () => {
    expect(
      formatSmsPickConfirmation({
        added: [
          { rank: 2, proposal: proposal('108', 'Rec center', 240_000) },
          { rank: 3, proposal: proposal('371', 'Trees', 150_000) },
        ],
        pickCount: 3,
        maxVotesPerMember: 4,
      }),
    ).toBe(
      'Pick 2: "Rec center" ($240,000). Pick 3: "Trees" ($150,000). 1 pick left. Text another code, LIST to see your ballot, or DONE to review.',
    );
  });

  it('omits the picks left when there is no limit', () => {
    expect(
      formatSmsPickConfirmation({
        added: [{ rank: 1, proposal: proposal('101', 'A', null) }],
        pickCount: 1,
        maxVotesPerMember: null,
      }),
    ).toBe(
      'Pick 1: "A". Text another code, LIST to see your ballot, or DONE to review.',
    );
  });
});

describe('formatSmsBallot', () => {
  it('lists picks in order with their cost and asks for SUBMIT', () => {
    expect(
      formatSmsBallot({
        decisionName: 'Park',
        picks: [
          proposal('101', 'Lights', 85_000),
          proposal('102', 'Trees', null),
        ],
      }),
    ).toBe(
      [
        'Your ballot for "Park":',
        '1. Lights $85,000',
        '2. Trees',
        'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
      ].join('\n'),
    );
  });

  it('given no picks, then it says the ballot is empty', () => {
    expect(formatSmsBallot({ decisionName: 'Park', picks: [] })).toContain(
      'Your ballot is empty.',
    );
  });
});
