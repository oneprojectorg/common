import { mergeRouters } from '../../trpcFactory';
import { translateDecisionRouter } from './translateDecision';
import { translatePhaseRubricRouter } from './translatePhaseRubric';
import { translatePostsRouter } from './translatePosts';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';
import { translateResourcesRouter } from './translateResources';
import { translateRubricRouter } from './translateRubric';

export const translationRouter = mergeRouters(
  translateDecisionRouter,
  translatePostsRouter,
  translateProposalRouter,
  translateProposalsRouter,
  translatePhaseRubricRouter,
  translateResourcesRouter,
  translateRubricRouter,
);
