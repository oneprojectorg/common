import type { SelectionPipeline } from './types';

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
