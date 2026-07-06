import { mergeRouters } from '../../../trpcFactory';
import { createInstanceFromTemplateRouter } from './createInstanceFromTemplate';
import { deleteDecisionRouter } from './deleteDecision';
import { duplicateInstanceRouter } from './duplicateInstance';
import { getCategoriesRouter } from './getCategories';
import { getDecisionBySlugRouter } from './getDecisionBySlug';
import { getInstanceRouter, getLegacyInstanceRouter } from './getInstance';
import { getPhaseReviewProgressRouter } from './getPhaseReviewProgress';
import { listDecisionProfilesRouter } from './listDecisionProfiles';
import { listLegacyInstancesRouter } from './listLegacyInstances';
import { listProposalSubmittersRouter } from './listProposalSubmitters';
import { listSelectionCandidatesRouter } from './listSelectionCandidates';
import { removeOverviewHeroImageRouter } from './removeOverviewHeroImage';
import { removePhaseHeroImageRouter } from './removePhaseHeroImage';
import { signOverviewHeroImageUploadUrlRouter } from './signOverviewHeroImageUploadUrl';
import { signPhaseHeroImageUploadUrlRouter } from './signPhaseHeroImageUploadUrl';
import { submitManualSelectionRouter } from './submitManualSelection';
import { transitionFromPhaseRouter } from './transitionFromPhase';
import { updateDecisionInstanceRouter } from './updateDecisionInstance';
import { updateOverviewHeroImageRouter } from './updateOverviewHeroImage';
import { updatePhaseHeroImageRouter } from './updatePhaseHeroImage';

export const instancesRouter = mergeRouters(
  createInstanceFromTemplateRouter,
  deleteDecisionRouter,
  duplicateInstanceRouter,
  updateDecisionInstanceRouter,
  signOverviewHeroImageUploadUrlRouter,
  updateOverviewHeroImageRouter,
  removeOverviewHeroImageRouter,
  signPhaseHeroImageUploadUrlRouter,
  updatePhaseHeroImageRouter,
  removePhaseHeroImageRouter,
  transitionFromPhaseRouter,
  listLegacyInstancesRouter,
  getInstanceRouter,
  getLegacyInstanceRouter,
  getPhaseReviewProgressRouter,
  getCategoriesRouter,
  listSelectionCandidatesRouter,
  submitManualSelectionRouter,
  listDecisionProfilesRouter,
  getDecisionBySlugRouter,
  listProposalSubmittersRouter,
);
