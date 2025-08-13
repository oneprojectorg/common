import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { listInstancesRouter } from './listInstances';

export const instancesRouter = mergeRouters(createInstanceRouter, listInstancesRouter);
