import { mergeRouters } from '../../../trpcFactory';
import { acceptProposalInviteRouter } from './acceptProposalInvite';
import { createProposalRouter } from './create';
import { deleteProposalRouter } from './delete';
import { exportProposalsRouter } from './export';
import { getProposalRouter } from './get';
import { getCollabTokenRouter } from './getCollabToken';
import { getExportStatusRouter } from './getExportStatus';
import { listProposalsRouter } from './list';
import { submitProposalRouter } from './submit';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  acceptProposalInviteRouter,
  createProposalRouter,
  getProposalRouter,
  getCollabTokenRouter,
  listProposalsRouter,
  submitProposalRouter,
  updateProposalRouter,
  deleteProposalRouter,
  exportProposalsRouter,
  getExportStatusRouter,
);
