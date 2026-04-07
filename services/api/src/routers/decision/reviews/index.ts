import { mergeRouters } from '../../../trpcFactory';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { saveReviewDraftRouter } from './saveReviewDraft';
import { submitReviewRouter } from './submitReview';

export const reviewsRouter = mergeRouters(
  listReviewAssignmentsRouter,
  getReviewAssignmentRouter,
  saveReviewDraftRouter,
  submitReviewRouter,
);
