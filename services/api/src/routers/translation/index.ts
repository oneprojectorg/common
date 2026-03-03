import { mergeRouters } from '../../trpcFactory';
import { translateProposalRouter } from './translateProposal';
import { translateProposalBatchRouter } from './translateProposalBatch';

export const translationRouter = mergeRouters(
  translateProposalRouter,
  translateProposalBatchRouter,
);
