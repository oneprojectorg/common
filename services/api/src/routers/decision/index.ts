import { mergeRouters } from '../../trpcFactory';
import { deleteProposalAttachment } from './deleteProposalAttachment';
import { instancesRouter } from './instances';
import { processesRouter } from './processes';
import { proposalsRouter } from './proposals';
import { resultsRouter } from './results';
import { reviewsRouter } from './reviews';
import { uploadProposalAttachment } from './uploadProposalAttachment';
import { votingRouter } from './voting';

export const decisionRouter = mergeRouters(
  processesRouter,
  instancesRouter,
  proposalsRouter,
  reviewsRouter,
  resultsRouter,
  uploadProposalAttachment,
  deleteProposalAttachment,
  votingRouter,
);
