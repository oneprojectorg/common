import { describe, expect, it } from 'vitest';

import type { BallotBudget } from './ballot';
import { getVotingIntroSteps } from './votingIntro';

const budget: BallotBudget = {
  voterBudget: 1000,
  voterCostField: 'budget',
  unit: { kind: 'currency', code: 'USD' },
};

describe('getVotingIntroSteps', () => {
  it('shows nothing when neither rule is on', () => {
    expect(getVotingIntroSteps({ ranked: false })).toEqual([]);
  });

  it('shows only the budget step on a budget-only vote', () => {
    expect(getVotingIntroSteps({ ranked: false, budget })).toEqual([
      { kind: 'budget', budget },
    ]);
  });

  it('shows only the ranked step on a ranked-only vote', () => {
    expect(getVotingIntroSteps({ ranked: true })).toEqual([{ kind: 'ranked' }]);
  });

  it('shows the budget step before the ranked step when both rules are on', () => {
    expect(getVotingIntroSteps({ ranked: true, budget })).toEqual([
      { kind: 'budget', budget },
      { kind: 'ranked' },
    ]);
  });
});
