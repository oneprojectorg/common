import { mergeRouters } from '../../trpcFactory';
import { translateDecisionRouter } from './translateDecision';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';

export const translationRouter = mergeRouters(
  translateDecisionRouter,
  translateProposalRouter,
  translateProposalsRouter,
);
