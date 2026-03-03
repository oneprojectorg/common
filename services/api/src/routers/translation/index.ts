import { mergeRouters } from '../../trpcFactory';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';

export const translationRouter = mergeRouters(
  translateProposalRouter,
  translateProposalsRouter,
);
