import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { createInstanceFromTemplateRouter } from './createInstanceFromTemplate';
import { getCategoriesRouter } from './getCategories';
import { getDecisionBySlugRouter } from './getDecisionBySlug';
import { getInstanceRouter } from './getInstance';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { listInstancesRouter } from './listInstances';
import { updateInstanceRouter } from './updateInstance';
import { updateInstanceFromTemplateRouter } from './updateInstanceFromTemplate';

export const instancesRouter = mergeRouters(
  createInstanceRouter,
  createInstanceFromTemplateRouter,
  updateInstanceRouter,
  updateInstanceFromTemplateRouter,
  listInstancesRouter,
  getInstanceRouter,
  getCategoriesRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
);
