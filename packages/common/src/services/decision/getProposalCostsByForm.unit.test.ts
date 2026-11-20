import type { AmountUnit } from '@op/types/amountUnit';
import { describe, expect, it, vi } from 'vitest';

import { BallotCostError } from '../../utils';
import { type ProposalCost, getAmountsInUnit } from './getProposalCostsByForm';

// The module also resolves templates; this file covers only the pure conversion.
vi.mock('@op/db/client', () => ({ db: {} }));

const USD: AmountUnit = { kind: 'currency', code: 'USD' };
const EUR: AmountUnit = { kind: 'currency', code: 'EUR' };

const proposal = { id: 'p1', proposalData: { title: 'Crosswalk' } };

const amountOf = ({
  cost,
  unreadable,
}: {
  cost: ProposalCost;
  unreadable: 'throw' | 'null';
}) =>
  getAmountsInUnit({
    proposals: [proposal],
    costs: new Map([[proposal.id, cost]]),
    unit: USD,
    voterCostField: 'cost',
    unreadable,
  }).get(proposal.id);

describe('getAmountsInUnit', () => {
  it('keeps the amount of a cost priced in the budget unit, in both modes', () => {
    for (const unreadable of ['throw', 'null'] as const) {
      expect(amountOf({ cost: { amount: 3, unit: USD }, unreadable })).toBe(3);
    }
  });

  it('keeps a blank cost in the budget unit as no amount', () => {
    expect(
      amountOf({ cost: { amount: null, unit: USD }, unreadable: 'throw' }),
    ).toBeNull();
  });

  it('refuses a cost priced in another unit: null when unreadable is null, BallotCostError when it is throw', () => {
    const cost = { amount: 3, unit: EUR };

    expect(amountOf({ cost, unreadable: 'null' })).toBeNull();
    expect(() => amountOf({ cost, unreadable: 'throw' })).toThrow(
      BallotCostError,
    );
  });

  it('refuses a cost whose form does not price the field: null when unreadable is null, BallotCostError when it is throw', () => {
    const cost = { amount: null, unit: undefined };

    expect(amountOf({ cost, unreadable: 'null' })).toBeNull();
    expect(() => amountOf({ cost, unreadable: 'throw' })).toThrow(
      'The cost of "Crosswalk" is not priced in the unit of the voter budget',
    );
  });
});
