import { describe, expect, it } from 'vitest';

import {
  formatSmsBallot,
  formatSmsPickDuplicate,
  formatSmsPickMoved,
  formatSmsPickOverBudget,
  formatSmsPickRemoved,
  formatSmsPicksAdded,
} from './formatSmsBallot';

describe('formatSmsPicksAdded', () => {
  it('given the first pick under a budget, then the text names the pick, what is left and the next steps', () => {
    expect(
      formatSmsPicksAdded({
        picks: [
          {
            position: 1,
            title: 'Fifth Ave crosswalk lighting',
            cost: '$85,000',
          },
        ],
        remaining: '$915,000',
        firstPick: true,
      }),
    ).toEqual([
      'Pick 1: "Fifth Ave crosswalk lighting" ($85,000). $915,000 left. Text another code, LIST to see your ballot, or DONE to review.',
    ]);
  });

  it('given two picks added in one text to a ballot that already had one, then both are numbered and no next-steps hint follows', () => {
    expect(
      formatSmsPicksAdded({
        picks: [
          {
            position: 2,
            title: 'Linden rec center evening hours',
            cost: '$240,000',
          },
          {
            position: 3,
            title: 'Neighborhood tree planting',
            cost: '$150,000',
          },
        ],
        remaining: '$525,000',
        firstPick: false,
      }),
    ).toEqual([
      'Pick 2: "Linden rec center evening hours" ($240,000). Pick 3: "Neighborhood tree planting" ($150,000). $525,000 left.',
    ]);
  });

  it('given no budget cap, then no amount is said to be left', () => {
    expect(
      formatSmsPicksAdded({
        picks: [{ position: 1, title: 'Tree planting', cost: null }],
        remaining: null,
        firstPick: false,
      }),
    ).toEqual(['Pick 1: "Tree planting".']);
  });
});

describe('formatSmsPickOverBudget', () => {
  it('given a pick that does not fit, then the text says what it costs, what is left and how to make room', () => {
    expect(
      formatSmsPickOverBudget({
        title: 'Main St resurfacing',
        cost: '$600,000',
        remaining: '$525,000',
      }),
    ).toEqual([
      '"Main St resurfacing" costs $600,000. You have $525,000 left. Reply REMOVE plus a code to make room, or pick a smaller project.',
    ]);
  });
});

describe('formatSmsBallot', () => {
  const picks = [
    { position: 1, title: 'Fifth Ave crosswalk lighting', cost: '$85,000' },
    { position: 2, title: 'Linden rec center evening hours', cost: '$240,000' },
    { position: 3, title: 'Neighborhood tree planting', cost: '$150,000' },
  ];

  it('given DONE, then the ballot is listed in rank order with totals, the ranking note and the SUBMIT prompt', () => {
    expect(
      formatSmsBallot({
        scope: 'District 5',
        picks,
        allocated: '$475,000',
        unspent: '$525,000',
        review: true,
      }),
    ).toEqual([
      [
        'Your District 5 ballot:',
        '1. Fifth Ave crosswalk lighting $85,000.',
        '2. Linden rec center evening hours $240,000.',
        '3. Neighborhood tree planting $150,000.',
        '$475,000 allocated, $525,000 unspent.',
        "Your order is your ranking: if a pick can't be funded, your support moves to your next choice.",
        'Reply SUBMIT to cast your ballot.',
      ].join('\n'),
    ]);
  });

  it('given LIST, then the ballot is listed with totals and the next-steps footer', () => {
    expect(
      formatSmsBallot({
        scope: '"Park Funding"',
        picks: picks.slice(0, 1),
        allocated: '$85,000',
        unspent: '$915,000',
        review: false,
      }),
    ).toEqual([
      'Your "Park Funding" ballot:\n1. Fifth Ave crosswalk lighting $85,000.\n$85,000 allocated, $915,000 unspent.\nText DONE to review, or a code to add.',
    ]);
  });

  it('given no picks, then the text says the ballot is empty and how to add to it', () => {
    expect(
      formatSmsBallot({
        scope: 'District 5',
        picks: [],
        allocated: null,
        unspent: null,
        review: true,
      }),
    ).toEqual([
      'Your ballot is empty. Text a code from your guide, or PROPOSALS to browse.',
    ]);
  });
});

describe('pick changes', () => {
  it('given a removed pick, then the text names it and what is left', () => {
    expect(
      formatSmsPickRemoved({ title: 'Tree planting', remaining: '$1,000,000' }),
    ).toBe('Removed "Tree planting". $1,000,000 left.');
    expect(
      formatSmsPickRemoved({ title: 'Tree planting', remaining: null }),
    ).toBe('Removed "Tree planting".');
  });

  it('given a moved or repeated pick, then the text names its position', () => {
    expect(formatSmsPickMoved({ title: 'Bike lane', position: 1 })).toBe(
      '"Bike lane" is now pick 1.',
    );
    expect(formatSmsPickDuplicate({ title: 'Bike lane', position: 2 })).toBe(
      '"Bike lane" is already pick 2.',
    );
  });
});

describe('formatSmsBallot on an unranked phase', () => {
  it('given DONE where order is not rank, then the ranking note is left out', () => {
    expect(
      formatSmsBallot({
        scope: 'District 5',
        picks: [{ position: 1, title: 'Tree planting', cost: null }],
        allocated: null,
        unspent: null,
        review: true,
        ranked: false,
      }),
    ).toEqual([
      'Your District 5 ballot:\n1. Tree planting.\nReply SUBMIT to cast your ballot.',
    ]);
  });
});
