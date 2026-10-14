import { describe, expect, it } from 'vitest';

import {
  formatSmsBallot,
  formatSmsBallotWelcome,
  formatSmsCost,
  formatSmsPickConfirmation,
  formatSmsProposalInfo,
  formatSmsProposalPages,
  SMS_BALLOT_EMPTY,
  SMS_MAX_BODY_LENGTH,
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

  it('given a currency code Intl does not know, then it formats in the default currency instead of throwing', () => {
    expect(formatSmsCost(85_000, 'dollars')).toBe('$85,000');
    expect(formatSmsCost(85_000, '')).toBe('$85,000');
  });
});

describe('formatSmsProposalPages', () => {
  const proposals = Array.from({ length: 7 }, (_, i) =>
    proposal(String(101 + i), `Proposal ${i + 1}`, (i + 1) * 10_000),
  );

  it('given seven short proposals, then one text carries the count, every line and the call to action', () => {
    expect(formatSmsProposalPages({ decisionName: 'Park', proposals })).toEqual(
      [
        [
          '"Park" has 7 proposals:',
          '101 Proposal 1 $10k',
          '102 Proposal 2 $20k',
          '103 Proposal 3 $30k',
          '104 Proposal 4 $40k',
          '105 Proposal 5 $50k',
          '106 Proposal 6 $60k',
          '107 Proposal 7 $70k',
          'Text a code to add it to your ballot, or INFO plus a code.',
        ].join('\n'),
      ],
    );
  });

  it('given forty proposals with titles as long as a title can be under a name as long as a name can be, then every text fits and the call to action closes the last', () => {
    const long = Array.from({ length: 40 }, (_, i) =>
      proposal(String(101 + i), `Proposal ${i + 1} `.padEnd(256, 'x'), 10_000),
    );

    const bodies = formatSmsProposalPages({
      decisionName: 'Park '.padEnd(256, 'y'),
      proposals: long,
    });

    expect(bodies.length).toBeGreaterThan(1);
    bodies.forEach((body) => {
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    });
    expect(
      bodies
        .at(-1)!
        .endsWith('Text a code to add it to your ballot, or INFO plus a code.'),
    ).toBe(true);
    expect(bodies.join('\n')).toContain('\n140 Proposal 40');
  });

  it('given a proposal whose currency code Intl does not know, then its line shows the amount in the default currency instead of throwing', () => {
    const [body] = formatSmsProposalPages({
      decisionName: 'Park',
      proposals: [
        { ...proposal('101', 'Odd money', 85_000), currency: 'dollars' },
      ],
    });
    expect(body).toContain('101 Odd money $85k\n');
  });

  it('given a slug, then the call to action starts a ballot for that decision instead of naming a bare code', () => {
    const [body] = formatSmsProposalPages({
      decisionName: 'Park',
      slug: 'park-2026',
      proposals: [proposal('101', 'Free idea', null)],
    });
    expect(
      body.endsWith(
        'Text VOTE park-2026 to start your ballot, or INFO park-2026 plus a code.',
      ),
    ).toBe(true);
    expect(body).not.toContain('Text a code');
  });

  it('given a proposal with no cost, then its line omits the amount', () => {
    const [body] = formatSmsProposalPages({
      decisionName: 'Park',
      proposals: [proposal('101', 'Free idea', null)],
    });
    expect(body).toContain('101 Free idea\n');
  });
});

describe('formatSmsProposalInfo', () => {
  it('given a slug, then the call to action starts a ballot for that decision instead of naming the code', () => {
    expect(
      formatSmsProposalInfo(proposal('218', 'Bike lane', null), {
        slug: 'park-2026',
      }),
    ).toBe('218: "Bike lane". Text VOTE park-2026 to start your ballot.');
  });

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

  it('given a summary longer than one text can carry, then the summary is cut so the whole body fits and the call to action survives', () => {
    const summary = Array.from({ length: 400 }, () => 'words').join(' ');

    const body = formatSmsProposalInfo(
      proposal('218', 'Bike lane', 310_000, summary),
    );

    expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    expect(body.startsWith('218: "Bike lane" ($310,000). words')).toBe(true);
    expect(body.endsWith('… Text 218 to add it to your ballot.')).toBe(true);
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
    ).toEqual([
      'Pick 2: "Rec center" ($240,000). Pick 3: "Trees" ($150,000). 1 pick left. Text another code, LIST to see your ballot, or DONE to review.',
    ]);
  });

  it('omits the picks left when there is no limit', () => {
    expect(
      formatSmsPickConfirmation({
        added: [{ rank: 1, proposal: proposal('101', 'A', null) }],
        pickCount: 1,
        maxVotesPerMember: null,
      }),
    ).toEqual([
      'Pick 1: "A". Text another code, LIST to see your ballot, or DONE to review.',
    ]);
  });

  it('given notes about codes that were not added, then they come before the picks', () => {
    expect(
      formatSmsPickConfirmation({
        notes: ['No proposal with code 999.'],
        added: [{ rank: 1, proposal: proposal('101', 'A', null) }],
        pickCount: 1,
        maxVotesPerMember: null,
      }),
    ).toEqual([
      'No proposal with code 999. Pick 1: "A". Text another code, LIST to see your ballot, or DONE to review.',
    ]);
  });

  it('given twenty codes in one text with titles as long as a title can be, then every confirmation fits a text and the guidance closes the last', () => {
    const added = Array.from({ length: 20 }, (_, i) => ({
      rank: i + 1,
      proposal: proposal(
        String(101 + i),
        `Proposal ${i + 1} `.padEnd(256, 'x'),
        10_000,
      ),
    }));

    const bodies = formatSmsPickConfirmation({
      added,
      pickCount: 20,
      maxVotesPerMember: null,
    });

    expect(bodies.length).toBeGreaterThan(1);
    bodies.forEach((body) => {
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    });
    expect(
      bodies
        .at(-1)!
        .endsWith(
          'Text another code, LIST to see your ballot, or DONE to review.',
        ),
    ).toBe(true);
    expect(bodies.join(' ')).toContain('Pick 20: "Proposal 20');
  });
});

describe('formatSmsBallot', () => {
  it('given ten picks with titles as long as a title can be, then one text fits and still asks for SUBMIT', () => {
    const picks = Array.from({ length: 10 }, (_, i) =>
      proposal(String(101 + i), `Proposal ${i + 1} `.padEnd(256, 'x'), 10_000),
    );

    const [body, ...rest] = formatSmsBallot({ decisionName: 'Park', picks });

    expect(rest).toEqual([]);
    expect(body!.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    expect(body!.split('\n')).toHaveLength(12);
    expect(
      body!.endsWith(
        'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
      ),
    ).toBe(true);
  });

  it('given thirty picks on a ballot with no limit, then every text fits, the heading opens the first and SUBMIT closes the last', () => {
    const picks = Array.from({ length: 30 }, (_, i) =>
      proposal(String(101 + i), `Proposal ${i + 1} `.padEnd(256, 'x'), 10_000),
    );

    const bodies = formatSmsBallot({ decisionName: 'Park', picks });

    expect(bodies.length).toBeGreaterThan(1);
    bodies.forEach((body) => {
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_BODY_LENGTH);
    });
    expect(bodies[0]!.startsWith('Your ballot for "Park":')).toBe(true);
    expect(
      bodies
        .at(-1)!
        .endsWith(
          'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
        ),
    ).toBe(true);
    expect(bodies.join('\n')).toContain('\n30. Proposal 30');
  });

  it('lists picks in order with their cost and asks for SUBMIT', () => {
    expect(
      formatSmsBallot({
        decisionName: 'Park',
        picks: [
          proposal('101', 'Lights', 85_000),
          proposal('102', 'Trees', null),
        ],
      }),
    ).toEqual([
      [
        'Your ballot for "Park":',
        '1. Lights $85,000',
        '2. Trees',
        'Reply SUBMIT to cast your ballot, or REMOVE plus a code to change it.',
      ].join('\n'),
    ]);
  });

  it('given no picks, then it says the ballot is empty', () => {
    expect(formatSmsBallot({ decisionName: 'Park', picks: [] })).toEqual([
      SMS_BALLOT_EMPTY,
    ]);
    expect(SMS_BALLOT_EMPTY).toContain('Your ballot is empty.');
  });
});
