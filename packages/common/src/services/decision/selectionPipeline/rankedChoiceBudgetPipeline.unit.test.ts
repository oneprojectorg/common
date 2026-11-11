import { describe, expect, it } from 'vitest';

import {
  buildProposalRow,
  buildVoteAggregation,
} from '../../../../testing/helpers/proposalRows';
import { getPipelineScores } from './getPipelineScores';
import { executeSelectionPipeline } from './pipelineEngine';
import { rankedChoiceBudgetPipeline } from './rankedChoiceBudgetPipeline';
import type { ExecutionContext } from './types';

interface Seed {
  id: string;
  budget: number;
  rankCounts: { [rank: number]: number };
  createdAt?: string;
}

function buildContext(seeds: Seed[], budget: number): ExecutionContext {
  return {
    proposals: seeds.map(({ id, createdAt }) =>
      buildProposalRow({ id, ...(createdAt && { createdAt }) }),
    ),
    proposalCosts: new Map(seeds.map(({ id, budget: cost }) => [id, cost])),
    voteData: Object.fromEntries(
      seeds.map(({ id, rankCounts }) => [
        id,
        buildVoteAggregation({
          proposalId: id,
          rankCounts,
          voteCount: Object.values(rankCounts).reduce((sum, n) => sum + n, 0),
        }),
      ]),
    ),
    variables: { budget },
    outputs: {},
  };
}

describe('rankedChoiceBudgetPipeline', () => {
  it('scores 5, 4, 3, 2 and then 1 from the fifth choice', async () => {
    const context = buildContext(
      [
        {
          id: 'p',
          budget: 1,
          rankCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 7: 1 },
        },
      ],
      10,
    );

    const [selected] = await executeSelectionPipeline(
      rankedChoiceBudgetPipeline,
      context,
    );

    expect(getPipelineScores(selected!).rankPoints).toBe(5 + 4 + 3 + 2 + 1 + 1);
  });

  it('orders proposals by points and skips the ones the remaining budget cannot cover', async () => {
    const context = buildContext(
      [
        { id: 'd', budget: 100, rankCounts: { 1: 1 } },
        { id: 'c', budget: 200, rankCounts: { 1: 1, 3: 1 } },
        { id: 'b', budget: 500, rankCounts: { 1: 1, 2: 1 } },
        { id: 'a', budget: 400, rankCounts: { 1: 2 } },
      ],
      1000,
    );

    const selected = await executeSelectionPipeline(
      rankedChoiceBudgetPipeline,
      context,
    );

    expect(selected.map((proposal) => proposal.id)).toEqual(['a', 'b', 'd']);
    expect(context.skipped?.map((proposal) => proposal.id)).toEqual(['c']);
    expect(getPipelineScores(context.skipped![0]!)).toMatchObject({
      rankPoints: 8,
      position: 3,
      cost: 200,
      budgetRemaining: 100,
    });
  });

  it('breaks a points tie by vote count, then by earliest submission', async () => {
    const context = buildContext(
      [
        {
          id: 'later',
          budget: 1,
          rankCounts: { 1: 1 },
          createdAt: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 'earlier',
          budget: 1,
          rankCounts: { 1: 1 },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        { id: 'more-votes', budget: 1, rankCounts: { 2: 1, 5: 1 } },
      ],
      10,
    );

    const selected = await executeSelectionPipeline(
      rankedChoiceBudgetPipeline,
      context,
    );

    expect(selected.map((proposal) => proposal.id)).toEqual([
      'more-votes',
      'earlier',
      'later',
    ]);
  });
});
