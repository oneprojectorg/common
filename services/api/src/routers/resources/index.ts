import { mergeRouters } from '../../trpcFactory';
import { collectionsRouter } from './collections';

export const resourcesRouter = mergeRouters(collectionsRouter);
