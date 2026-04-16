import { mergeRouters } from '../../../trpcFactory';
import { cancelRevisionRequestRouter } from './cancelRevisionRequest';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { requestRevisionRouter } from './requestRevision';
import { submitReviewRouter } from './submitReview';

export const reviewsRouter = mergeRouters(
  cancelRevisionRequestRouter,
  getReviewAssignmentRouter,
  listReviewAssignmentsRouter,
  requestRevisionRouter,
  submitReviewRouter,
);
