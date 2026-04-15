import { mergeRouters } from '../../../trpcFactory';
import { cancelRevisionRequestRouter } from './cancelRevisionRequest';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listProposalsRevisionRequestsRouter } from './listProposalsRevisionRequests';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { requestRevisionRouter } from './requestRevision';
import { submitReviewRouter } from './submitReview';
import { submitRevisionResponseRouter } from './submitRevisionResponse';

export const reviewsRouter = mergeRouters(
  cancelRevisionRequestRouter,
  getReviewAssignmentRouter,
  listProposalsRevisionRequestsRouter,
  listReviewAssignmentsRouter,
  requestRevisionRouter,
  submitRevisionResponseRouter,
  submitReviewRouter,
);
