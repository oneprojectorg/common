import { mergeRouters } from '../../../trpcFactory';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { submitReviewRouter } from './submitReview';

export const reviewsRouter = mergeRouters(
  getReviewAssignmentRouter,
  submitReviewRouter,
);
