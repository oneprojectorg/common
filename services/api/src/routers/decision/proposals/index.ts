import { mergeRouters } from '../../../trpcFactory';
import { acceptProposalInviteRouter } from './acceptProposalInvite';
import { addProposalRelationshipRouter } from './addRelationship';
import { advanceProposalRouter } from './advanceProposal';
import { confirmCategoryDevelopmentRouter } from './confirmCategoryDevelopment';
import { createProposalRouter } from './create';
import { createDevelopedProposalRouter } from './createDeveloped';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getCollabTokenRouter } from './getCollabToken';
import { getDevelopConfirmStateRouter } from './getDevelopConfirmState';
import { getDevelopEntryLockRouter } from './getDevelopEntryLock';
import { getExportStatusRouter } from './getExportStatus';
import { getLatestSelectionForProposalRouter } from './getLatestSelection';
import { getProposalAdvanceTargetRouter } from './getProposalAdvanceTarget';
import { getProposalWithReviewAggregatesRouter } from './getProposalWithReviewAggregates';
import { getReviewedVersionRouter } from './getReviewedVersion';
import { listProposalsRouter } from './list';
import { listContributingProposalsRouter } from './listContributingProposals';
import { listDevelopSourcesRouter } from './listDevelopSources';
import { listProposalLocationsRouter } from './listProposalLocations';
import { listProposalRelationshipsRouter } from './listProposalRelationships';
import { listWithReviewAggregatesRouter } from './listWithReviewAggregates';
import { mergeProposalsRouter } from './mergeProposals';
import { publishDevelopedProposalsRouter } from './publishDevelopedProposals';
import { rejectProposalRouter } from './reject';
import { removeProposalRelationshipRouter } from './removeRelationship';
import { submitProposalRouter } from './submit';
import { submitDevelopedProposalRouter } from './submitDeveloped';
import { unconfirmCategoryDevelopmentRouter } from './unconfirmCategoryDevelopment';
import { unmergeProposalRouter } from './unmergeProposal';
import { unrejectProposalRouter } from './unreject';
import { unsubmitDevelopedProposalRouter } from './unsubmitDeveloped';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  acceptProposalInviteRouter,
  advanceProposalRouter,
  addProposalRelationshipRouter,
  removeProposalRelationshipRouter,
  createProposalRouter,
  createDevelopedProposalRouter,
  getProposalRouter,
  getProposalAdvanceTargetRouter,
  getCollabTokenRouter,
  getLatestSelectionForProposalRouter,
  getProposalWithReviewAggregatesRouter,
  getReviewedVersionRouter,
  listProposalsRouter,
  listProposalLocationsRouter,
  listProposalRelationshipsRouter,
  listContributingProposalsRouter,
  listDevelopSourcesRouter,
  getDevelopConfirmStateRouter,
  getDevelopEntryLockRouter,
  confirmCategoryDevelopmentRouter,
  unconfirmCategoryDevelopmentRouter,
  publishDevelopedProposalsRouter,
  listWithReviewAggregatesRouter,
  mergeProposalsRouter,
  rejectProposalRouter,
  unrejectProposalRouter,
  unmergeProposalRouter,
  submitProposalRouter,
  submitDevelopedProposalRouter,
  unsubmitDevelopedProposalRouter,
  updateProposalRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);
