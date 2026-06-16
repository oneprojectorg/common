import { mergeRouters } from '../../../trpcFactory';
import { acceptProposalInviteRouter } from './acceptProposalInvite';
import { createProposalRouter } from './create';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getExportStatusRouter } from './getExportStatus';
import { getLatestSelectionForProposalRouter } from './getLatestSelection';
import { getProposalWithReviewAggregatesRouter } from './getProposalWithReviewAggregates';
import { listProposalsRouter } from './list';
import { listProposalPostsRouter } from './listPosts';
import { listWithReviewAggregatesRouter } from './listWithReviewAggregates';
import { submitProposalRouter } from './submit';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  acceptProposalInviteRouter,
  createProposalRouter,
  getProposalRouter,
  getLatestSelectionForProposalRouter,
  getProposalWithReviewAggregatesRouter,
  listProposalsRouter,
  listProposalPostsRouter,
  listWithReviewAggregatesRouter,
  submitProposalRouter,
  updateProposalRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);
