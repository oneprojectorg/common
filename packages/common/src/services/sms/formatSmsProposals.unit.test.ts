import { describe, expect, it } from 'vitest';

import {
  formatSmsAttestation,
  formatSmsProposalInfo,
  formatSmsProposalPage,
} from './formatSmsProposals';

describe('formatSmsProposalPage', () => {
  it('given a page of coded proposals, then each line carries the code, the title and the cost, and the footer says how to get more', () => {
    expect(
      formatSmsProposalPage({
        items: [
          { code: 214, title: 'Fifth Ave crosswalk lighting', cost: '$85000' },
          { code: 108, title: 'Linden rec center evening hours', cost: null },
        ],
        hasMore: true,
      }),
    ).toEqual([
      'Proposals:\n214 Fifth Ave crosswalk lighting ($85000)\n108 Linden rec center evening hours\nText MORE for the next page.',
    ]);
  });

  it('given the last page, then there is no footer', () => {
    expect(
      formatSmsProposalPage({
        items: [{ code: 371, title: 'Tree planting', cost: '$150000' }],
        hasMore: false,
      }),
    ).toEqual(['Proposals:\n371 Tree planting ($150000)']);
  });

  it('given an empty ballot, then one text says so', () => {
    expect(formatSmsProposalPage({ items: [], hasMore: false })).toEqual([
      'No proposals are on the ballot yet.',
    ]);
  });

  it('given a title longer than a line should carry, then the title is clipped and the cost survives', () => {
    const [body] = formatSmsProposalPage({
      items: [{ code: 101, title: 'x'.repeat(200), cost: '$1' }],
      hasMore: false,
    });

    expect(body).toContain('...');
    expect(body?.endsWith('($1)')).toBe(true);
    expect(body!.length).toBeLessThan(200);
  });
});

describe('formatSmsProposalInfo', () => {
  it('given a proposal with a summary, then the heading names the code, title and cost and the summary follows', () => {
    expect(
      formatSmsProposalInfo({
        code: 214,
        title: 'Fifth Ave crosswalk lighting',
        cost: '$85000',
        summary: 'Lights at the Fifth Avenue crossing.',
      }),
    ).toEqual([
      '214 "Fifth Ave crosswalk lighting" ($85000)\nLights at the Fifth Avenue crossing.',
    ]);
  });

  it('given a proposal with no summary and no cost, then the text says there is no summary', () => {
    expect(
      formatSmsProposalInfo({
        code: 108,
        title: 'Linden rec center evening hours',
        cost: null,
        summary: null,
      }),
    ).toEqual(['108 "Linden rec center evening hours"\nNo summary.']);
  });

  it('given a summary longer than one text should carry, then it is clipped into one text that fits an SMS', () => {
    const parts = formatSmsProposalInfo({
      code: 101,
      title: 'Long',
      cost: null,
      summary: 'word '.repeat(600),
    });

    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('...');
    expect(parts[0]!.length).toBeLessThanOrEqual(1600);
  });
});

describe('formatSmsAttestation', () => {
  it('given the attestation text, then the member is told to reply AGREE after it', () => {
    expect(
      formatSmsAttestation(
        'I affirm that I meet the eligibility requirements.',
      ),
    ).toEqual([
      'I affirm that I meet the eligibility requirements.\nReply AGREE to affirm.',
    ]);
  });
});
