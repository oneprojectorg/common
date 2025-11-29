import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { updateInstanceRouter } from './updateInstance';
import { listInstancesRouter } from './listInstances';
import { getInstanceRouter } from './getInstance';
import { getCategoriesRouter } from './getCategories';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { getDecisionBySlugRouter } from './getDecisionBySlug';

export const instancesRouter = mergeRouters(
  createInstanceRouter,
  updateInstanceRouter,
  listInstancesRouter,
  getInstanceRouter,
  getCategoriesRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
);
