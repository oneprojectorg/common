import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';

export const instancesRouter = mergeRouters(createInstanceRouter);
