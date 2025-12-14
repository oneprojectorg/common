import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { getCategoriesRouter } from './getCategories';
import { getDecisionBySlugRouter } from './getDecisionBySlug';
import { getInstanceRouter } from './getInstance';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { listInstancesRouter } from './listInstances';
import { updateInstanceRouter } from './updateInstance';

export const instancesRouter = mergeRouters(
  createInstanceRouter,
  updateInstanceRouter,
  listInstancesRouter,
  getInstanceRouter,
  getCategoriesRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
);
