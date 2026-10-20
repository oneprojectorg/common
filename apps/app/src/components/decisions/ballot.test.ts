import { parseProposalData } from '@op/common/client';
import { describe, expect, it } from 'vitest';

import {
  type BallotBudget,
  canAffordProposal,
  formatBallotAmount,
  getBallotBudget,
  getBallotRank,
  getBallotRemaining,
  getBallotTotal,
  getProposalCost,
  moveBallotItem,
} from './ballot';

const budget: BallotBudget = {
  voterBudget: 100,
  voterCostField: 'budget',
  unit: { kind: 'currency', code: 'USD' },
};

const proposalCosting = (value: unknown) => ({
  proposalData: parseProposalData({ budget: value }),
});

describe('getBallotBudget', () => {
  it('returns the budget when the phase sets one with a unit', () => {
    expect(
      getBallotBudget({
        voterBudget: 100,
        voterCostField: 'budget',
        costUnit: { kind: 'currency', code: 'USD' },
      }),
    ).toEqual(budget);
  });

  it('returns undefined when the phase sets no voter budget', () => {
    expect(
      getBallotBudget({
        voterCostField: 'budget',
        costUnit: { kind: 'currency', code: 'USD' },
      }),
    ).toBeUndefined();
  });

  it('returns undefined when the cost field has no unit', () => {
    expect(
      getBallotBudget({ voterBudget: 100, voterCostField: 'budget' }),
    ).toBeUndefined();
  });
});

describe('getProposalCost', () => {
  it('reads the cost from the voter cost field', () => {
    expect(
      getProposalCost({
        proposal: proposalCosting({ amount: 40, currency: 'USD' }),
        budget,
      }),
    ).toBe(40);
  });

  it('reads a custom cost field', () => {
    expect(
      getProposalCost({
        proposal: { proposalData: parseProposalData({ points: 3 }) },
        budget: {
          voterBudget: 10,
          voterCostField: 'points',
          unit: { kind: 'custom', label: 'points' },
        },
      }),
    ).toBe(3);
  });

  it('charges nothing when the cost is missing', () => {
    expect(getProposalCost({ proposal: proposalCosting(null), budget })).toBe(
      0,
    );
  });

  it('charges nothing when the cost is in another currency', () => {
    expect(
      getProposalCost({
        proposal: proposalCosting({ amount: 40, currency: 'EUR' }),
        budget,
      }),
    ).toBe(0);
  });
});

describe('getBallotTotal', () => {
  it('sums the costs without floating-point drift', () => {
    expect(
      getBallotTotal({
        proposals: [
          proposalCosting({ amount: 0.1, currency: 'USD' }),
          proposalCosting({ amount: 0.2, currency: 'USD' }),
        ],
        budget,
      }),
    ).toBe(0.3);
  });
});

describe('getBallotRemaining', () => {
  it('subtracts the total from the budget without floating-point drift', () => {
    expect(
      getBallotRemaining({
        proposals: [proposalCosting({ amount: 99.7, currency: 'USD' })],
        budget,
      }),
    ).toBe(0.3);
  });

  it('never reports less than nothing left', () => {
    expect(
      getBallotRemaining({
        proposals: [proposalCosting({ amount: 140, currency: 'USD' })],
        budget,
      }),
    ).toBe(0);
  });
});

describe('canAffordProposal', () => {
  it('allows a proposal that exactly fills what is left', () => {
    expect(
      canAffordProposal({
        proposal: proposalCosting({ amount: 40, currency: 'USD' }),
        remaining: 40,
        budget,
      }),
    ).toBe(true);
  });

  it('rejects a proposal that costs more than what is left', () => {
    expect(
      canAffordProposal({
        proposal: proposalCosting({ amount: 40.01, currency: 'USD' }),
        remaining: 40,
        budget,
      }),
    ).toBe(false);
  });
});

describe('getBallotRank', () => {
  it('ranks from 1 in ballot order', () => {
    expect(getBallotRank({ ballotIds: ['a', 'b'], id: 'b' })).toBe(2);
  });

  it('returns undefined for a proposal not on the ballot', () => {
    expect(getBallotRank({ ballotIds: ['a'], id: 'c' })).toBeUndefined();
  });
});

describe('formatBallotAmount', () => {
  it('formats a currency amount as money', () => {
    expect(
      formatBallotAmount({
        amount: 1000000,
        unit: { kind: 'currency', code: 'USD' },
      }),
    ).toBe('$1,000,000');
  });

  it('formats a custom amount with its label', () => {
    expect(
      formatBallotAmount({
        amount: 3,
        unit: { kind: 'custom', label: 'points' },
      }),
    ).toBe('3 points');
  });
});

describe('moveBallotItem', () => {
  it('moves an item up one place', () => {
    expect(
      moveBallotItem({ items: ['a', 'b', 'c'], index: 2, offset: -1 }),
    ).toEqual(['a', 'c', 'b']);
  });

  it('moves an item down one place', () => {
    expect(
      moveBallotItem({ items: ['a', 'b', 'c'], index: 0, offset: 1 }),
    ).toEqual(['b', 'a', 'c']);
  });

  it('keeps the order when the move would leave the list', () => {
    const items = ['a', 'b'];

    expect(moveBallotItem({ items, index: 0, offset: -1 })).toBe(items);
    expect(moveBallotItem({ items, index: 1, offset: 1 })).toBe(items);
  });
});
