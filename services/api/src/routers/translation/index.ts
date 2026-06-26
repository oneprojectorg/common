import { mergeRouters } from '../../trpcFactory';
import { translateDecisionRouter } from './translateDecision';
import { translatePostsRouter } from './translatePosts';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';
import { translateResourcesRouter } from './translateResources';

export const translationRouter = mergeRouters(
  translateDecisionRouter,
  translatePostsRouter,
  translateProposalRouter,
  translateProposalsRouter,
  translateResourcesRouter,
);
