import { mergeRouters } from '../../trpcFactory';
import { translateCustomFormRouter } from './translateCustomForm';
import { translateDecisionRouter } from './translateDecision';
import { translatePostRouter } from './translatePost';
import { translateProposalRouter } from './translateProposal';
import { translateProposalsRouter } from './translateProposals';
import { translateResourcesRouter } from './translateResources';
import { translateReviewRouter } from './translateReview';
import { translateRevisionRequestRouter } from './translateRevisionRequest';

export const translationRouter = mergeRouters(
  translateCustomFormRouter,
  translateDecisionRouter,
  translatePostRouter,
  translateProposalRouter,
  translateProposalsRouter,
  translateResourcesRouter,
  translateReviewRouter,
  translateRevisionRequestRouter,
);
