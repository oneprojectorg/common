import { mergeRouters } from '../../../trpcFactory';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { submitReviewRouter } from './submitReview';

export const reviewsRouter = mergeRouters(
  getReviewAssignmentRouter,
  listReviewAssignmentsRouter,
  submitReviewRouter,
);
