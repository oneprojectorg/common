import { describe, expect, it } from 'vitest';

import {
  formatSmsBallotPageHeading,
  formatSmsBallotScope,
  formatSmsProposalNotOnBallot,
  formatSmsRegisterFirst,
} from './formatSmsBallotBrowse';
import { formatSmsProposalPage } from './formatSmsProposals';

describe('formatSmsBallotPageHeading', () => {
  it('given the first page, then the heading names the scope, the total and how many follow', () => {
    expect(
      formatSmsBallotPageHeading({
        scope: 'District 5',
        total: 35,
        count: 5,
        continued: false,
      }),
    ).toBe('District 5 has 35 proposals. First 5:');
  });

  it('given a later page, then the heading only counts what follows', () => {
    expect(
      formatSmsBallotPageHeading({
        scope: 'District 5',
        total: 35,
        count: 3,
        continued: true,
      }),
    ).toBe('Next 3:');
  });

  it('given one proposal in total, then the noun is singular', () => {
    expect(
      formatSmsBallotPageHeading({
        scope: '"Park Funding"',
        total: 1,
        count: 1,
        continued: false,
      }),
    ).toBe('"Park Funding" has 1 proposal. First 1:');
  });
});

describe('formatSmsBallotScope', () => {
  it('given a district, then the scope is the district; without one it is the quoted decision name', () => {
    expect(
      formatSmsBallotScope({ district: 'District 5', decisionName: 'Park' }),
    ).toBe('District 5');
    expect(formatSmsBallotScope({ district: null, decisionName: 'Park' })).toBe(
      '"Park"',
    );
  });
});

describe('a browse page', () => {
  it('given a heading and a footer, then the page carries both around the coded lines', () => {
    expect(
      formatSmsProposalPage({
        items: [
          { code: 214, title: 'Fifth Ave crosswalk lighting', cost: '$85,000' },
        ],
        hasMore: true,
        heading: 'District 5 has 35 proposals. First 1:',
        footer: 'Reply MORE for the rest, or INFO plus a code.',
      }),
    ).toEqual([
      'District 5 has 35 proposals. First 1:\n214 Fifth Ave crosswalk lighting ($85,000)\nReply MORE for the rest, or INFO plus a code.',
    ]);
  });
});

describe('browse refusals', () => {
  it('given a member who must register first, then the text names the decision and VOTE', () => {
    expect(formatSmsRegisterFirst('Park Funding')).toBe(
      'Text VOTE to register for "Park Funding" before browsing its proposals.',
    );
  });

  it('given a code that is not on the ballot, then the text repeats the code', () => {
    expect(formatSmsProposalNotOnBallot(999)).toBe(
      'No proposal with code 999 is on your ballot.',
    );
  });
});
