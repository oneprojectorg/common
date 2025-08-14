import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { updateInstanceRouter } from './updateInstance';
import { listInstancesRouter } from './listInstances';
import { getInstanceRouter } from './getInstance';

export const instancesRouter = mergeRouters(
  createInstanceRouter,
  updateInstanceRouter,
  listInstancesRouter,
  getInstanceRouter
);
