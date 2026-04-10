import { mergeRouters } from '../../../trpcFactory';
import { createInstanceFromTemplateRouter } from './createInstanceFromTemplate';
import { deleteDecisionRouter } from './deleteDecision';
import { duplicateInstanceRouter } from './duplicateInstance';
import { getCategoriesRouter } from './getCategories';
import { getDecisionBySlugRouter } from './getDecisionBySlug';
import { getInstanceRouter, getLegacyInstanceRouter } from './getInstance';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { listInstancesRouter } from './listInstances';
import { listLegacyInstancesRouter } from './listLegacyInstances';
import { updateDecisionInstanceRouter } from './updateDecisionInstance';

export const instancesRouter = mergeRouters(
  createInstanceFromTemplateRouter,
  deleteDecisionRouter,
  duplicateInstanceRouter,
  updateDecisionInstanceRouter,
  listInstancesRouter,
  listLegacyInstancesRouter,
  getInstanceRouter,
  getLegacyInstanceRouter,
  getCategoriesRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
);
