import { mergeRouters } from '../../../trpcFactory';
import { createProposalRouter } from './create';
import { deleteProposalRouter } from './delete';
import { getProposalRouter } from './get';
import { listProposalsRouter } from './list';
import { updateProposalRouter } from './update';

export const proposalsRouter = mergeRouters(
  createProposalRouter,
  getProposalRouter,
  listProposalsRouter,
  updateProposalRouter,
  deleteProposalRouter,
);