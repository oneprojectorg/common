import { mergeRouters } from '../../trpcFactory';
import { translateDecisionRouter } from './translateDecision';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';
import { translateResourcesRouter } from './translateResources';
import { translateUpdatesRouter } from './translateUpdates';

export const translationRouter = mergeRouters(
  translateDecisionRouter,
  translateProposalRouter,
  translateProposalsRouter,
  translateResourcesRouter,
  translateUpdatesRouter,
);
