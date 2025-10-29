import { mergeRouters } from '../../../trpcFactory';
import { getInstanceResultsRouter } from './getInstanceResults';

export const resultsRouter = mergeRouters(getInstanceResultsRouter);
