import { mergeRouters } from '../../../trpcFactory';
import { createInstanceRouter } from './createInstance';
import { createInstanceFromTemplateRouter } from './createInstanceFromTemplate';
import { deleteInstanceRouter } from './deleteInstance';
import { getCategoriesRouter } from './getCategories';
import { getDecisionBySlugRouter } from './getDecisionBySlug';
import { getInstanceRouter } from './getInstance';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { listInstancesRouter } from './listInstances';
import { updateInstanceRouter } from './updateInstance';

export const instancesRouter = mergeRouters(
  createInstanceRouter,
  createInstanceFromTemplateRouter,
  updateInstanceRouter,
  deleteInstanceRouter,
  listInstancesRouter,
  getInstanceRouter,
  getCategoriesRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
);
