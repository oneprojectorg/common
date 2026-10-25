import type { BallotBudget } from './ballot';

type VotingIntroStep =
  | { kind: 'budget'; budget: BallotBudget }
  | { kind: 'ranked' };

export function getVotingIntroSteps({
  ranked,
  budget,
}: {
  ranked: boolean;
  budget?: BallotBudget;
}): VotingIntroStep[] {
  const steps: VotingIntroStep[] = [];

  if (budget) {
    steps.push({ kind: 'budget', budget });
  }
  if (ranked) {
    steps.push({ kind: 'ranked' });
  }

  return steps;
}
