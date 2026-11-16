import type { SelectionPipeline } from './types';

/**
 * Scores each proposal from its ranked selections (5, 4, 3, 2, then 1 from the
 * 5th choice), orders by that score, and accepts proposals while the phase's
 * `budget` setting covers their cost.
 */
export const rankedChoiceBudgetPipeline: SelectionPipeline = {
  version: '1.0.0',
  blocks: [
    {
      id: 'rank-points',
      type: 'score',
      name: 'Ranked-choice points',
      scoreField: 'metadata.rankPoints',
      formula: [
        { field: 'voteData.rankCounts.1', weight: 5 },
        { field: 'voteData.rankCounts.2', weight: 4 },
        { field: 'voteData.rankCounts.3', weight: 3 },
        { field: 'voteData.rankCounts.4', weight: 2 },
        {
          expression: {
            operator: 'subtract',
            operands: [
              { field: 'voteData.voteCount' },
              { field: 'voteData.rankCounts.1' },
              { field: 'voteData.rankCounts.2' },
              { field: 'voteData.rankCounts.3' },
              { field: 'voteData.rankCounts.4' },
            ],
          },
          weight: 1,
        },
      ],
    },
    {
      id: 'sort-by-rank-points',
      type: 'sort',
      name: 'Order by points, then votes, then earliest submission',
      sortBy: [
        { field: 'metadata.rankPoints', order: 'desc' },
        { field: 'voteData.voteCount', order: 'desc' },
        { field: 'createdAt', order: 'asc' },
      ],
    },
    {
      id: 'fit-budget',
      type: 'budget',
      name: 'Accept proposals while the budget lasts',
      budget: { variable: 'budget' },
    },
  ],
};
