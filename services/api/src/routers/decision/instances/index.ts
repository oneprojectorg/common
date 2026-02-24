import { mergeRouters } from '../../../trpcFactory';
import { createInstanceFromTemplateRouter } from './createInstanceFromTemplate';
import { deleteInstanceRouter } from './deleteInstance';
import { getCategoriesRouter } from './getCategories';
import { getDecisionBySlugRouter } from './getDecisionBySlug';
import { getInstanceRouter, getLegacyInstanceRouter } from './getInstance';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { listInstancesRouter } from './listInstances';
import { listLegacyInstancesRouter } from './listLegacyInstances';
import { updateDecisionInstanceRouter } from './updateDecisionInstance';
import { updateInstanceRouter } from './updateInstance';

export const instancesRouter = mergeRouters(
  createInstanceFromTemplateRouter,
  updateInstanceRouter,
  updateDecisionInstanceRouter,
  deleteInstanceRouter,
  listInstancesRouter,
  listLegacyInstancesRouter,
  getInstanceRouter,
  getLegacyInstanceRouter,
  getCategoriesRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
);
