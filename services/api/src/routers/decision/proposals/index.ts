import { mergeRouters } from '../../../trpcFactory';
import { acceptProposalInviteRouter } from './acceptProposalInvite';
import { createProposalRouter } from './create';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getExportStatusRouter } from './getExportStatus';
import { getWithReviewAggregatesRouter } from './getWithReviewAggregates';
import { listProposalsRouter } from './list';
import { listProposalVersionsRouter } from './listVersions';
import { listWithReviewAggregatesRouter } from './listWithReviewAggregates';
import { submitProposalRouter } from './submit';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  acceptProposalInviteRouter,
  createProposalRouter,
  getProposalRouter,
  getWithReviewAggregatesRouter,
  listProposalsRouter,
  listProposalVersionsRouter,
  listWithReviewAggregatesRouter,
  submitProposalRouter,
  updateProposalRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);
