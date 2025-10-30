import { mergeRouters } from '../../../trpcFactory';
import { getInstanceResultsRouter } from './getInstanceResults';
import { getResultsStatsRouter } from './getResultsStats';

export const resultsRouter = mergeRouters(
  getInstanceResultsRouter,
  getResultsStatsRouter,
);
