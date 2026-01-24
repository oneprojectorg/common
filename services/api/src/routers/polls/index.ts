import { mergeRouters } from '../../trpcFactory';
import { createPollRouter } from './create';

export const pollsRouter = mergeRouters(createPollRouter);
