import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { updateInstanceRouter } from './updateInstance';
import { listInstancesRouter } from './listInstances';

export const instancesRouter = mergeRouters(
  createInstanceRouter,
  updateInstanceRouter,
  listInstancesRouter
);
