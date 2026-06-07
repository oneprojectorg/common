import { mergeRouters } from '../../../trpcFactory';
import { acceptProposalInviteRouter } from './acceptProposalInvite';
import { createProposalRouter } from './create';
import { createPublicProposalRouter } from './createPublic';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getExportStatusRouter } from './getExportStatus';
import { getLatestSelectionForProposalRouter } from './getLatestSelection';
import { getProposalWithReviewAggregatesRouter } from './getProposalWithReviewAggregates';
import { listProposalsRouter } from './list';
import { listWithReviewAggregatesRouter } from './listWithReviewAggregates';
import { submitProposalRouter } from './submit';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  acceptProposalInviteRouter,
  createProposalRouter,
  createPublicProposalRouter,
  getProposalRouter,
  getLatestSelectionForProposalRouter,
  getProposalWithReviewAggregatesRouter,
  listProposalsRouter,
  listWithReviewAggregatesRouter,
  submitProposalRouter,
  updateProposalRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);
