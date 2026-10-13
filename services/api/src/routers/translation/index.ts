import { mergeRouters } from '../../trpcFactory';
import { translateDecisionRouter } from './translateDecision';
import { translatePostRouter } from './translatePost';
import { translatePostsRouter } from './translatePosts';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';
import { translateResourcesRouter } from './translateResources';
import { translateReviewRouter } from './translateReview';
import { translateRevisionRequestRouter } from './translateRevisionRequest';
import { translateRubricRouter } from './translateRubric';

export const translationRouter = mergeRouters(
  translateDecisionRouter,
  translatePostRouter,
  translatePostsRouter,
  translateProposalRouter,
  translateProposalsRouter,
  translateResourcesRouter,
  translateReviewRouter,
  translateRevisionRequestRouter,
  translateRubricRouter,
);
