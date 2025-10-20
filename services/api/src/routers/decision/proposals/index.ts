import { mergeRouters } from '../../../trpcFactory';
import { createProposalRouter } from './create';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getExportStatusRouter } from './getExportStatus';
import { listProposalsRouter } from './list';
import { updateProposalRouter } from './update';
import { updateProposalStatusRouter } from './updateStatus';

export const proposalsRouter = mergeRouters(
  createProposalRouter,
  getProposalRouter,
  listProposalsRouter,
  updateProposalRouter,
  updateProposalStatusRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);