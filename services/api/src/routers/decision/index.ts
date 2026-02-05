import { mergeRouters } from '../../trpcFactory';
import { deleteProposalAttachment } from './deleteProposalAttachment';
import { instancesRouter } from './instances';
import { processesRouter } from './processes';
import { proposalsRouter } from './proposals';
import { resultsRouter } from './results';
import { uploadProposalAttachment } from './uploadProposalAttachment';
import { votingRouter } from './voting';

export const decisionRouter = mergeRouters(
  processesRouter,
  instancesRouter,
  proposalsRouter,
  resultsRouter,
  uploadProposalAttachment,
  deleteProposalAttachment,
  votingRouter,
);
