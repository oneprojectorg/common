import { mergeRouters } from '../../../trpcFactory';
import { acceptProposalInviteRouter } from './acceptProposalInvite';
import { addProposalRelationshipRouter } from './addRelationship';
import { createProposalRouter } from './create';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getExportStatusRouter } from './getExportStatus';
import { getLatestSelectionForProposalRouter } from './getLatestSelection';
import { getProposalWithReviewAggregatesRouter } from './getProposalWithReviewAggregates';
import { listProposalsRouter } from './list';
import { listContributingProposalsRouter } from './listContributingProposals';
import { listProposalLocationsRouter } from './listProposalLocations';
import { listProposalRelationshipsRouter } from './listProposalRelationships';
import { listWithReviewAggregatesRouter } from './listWithReviewAggregates';
import { mergeProposalsRouter } from './mergeProposals';
import { removeProposalRelationshipRouter } from './removeRelationship';
import { submitProposalRouter } from './submit';
import { unmergeProposalRouter } from './unmergeProposal';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  acceptProposalInviteRouter,
  addProposalRelationshipRouter,
  removeProposalRelationshipRouter,
  createProposalRouter,
  getProposalRouter,
  getLatestSelectionForProposalRouter,
  getProposalWithReviewAggregatesRouter,
  listProposalsRouter,
  listProposalLocationsRouter,
  listProposalRelationshipsRouter,
  listContributingProposalsRouter,
  listWithReviewAggregatesRouter,
  mergeProposalsRouter,
  unmergeProposalRouter,
  submitProposalRouter,
  updateProposalRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);
