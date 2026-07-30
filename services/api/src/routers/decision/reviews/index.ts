import { mergeRouters } from '../../../trpcFactory';
import { addCategoryReviewerRouter } from './addCategoryReviewer';
import { cancelRevisionRequestRouter } from './cancelRevisionRequest';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listCategoryReviewersRouter } from './listCategoryReviewers';
import { listProposalRevisionRequestsRouter } from './listProposalRevisionRequests';
import { listProposalsRevisionRequestsRouter } from './listProposalsRevisionRequests';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { removeCategoryReviewerRouter } from './removeCategoryReviewer';
import { requestRevisionRouter } from './requestRevision';
import { saveReviewDraftRouter } from './saveReviewDraft';
import { submitReviewRouter } from './submitReview';
import { submitRevisionResponseRouter } from './submitRevisionResponse';

export const reviewsRouter = mergeRouters(
  addCategoryReviewerRouter,
  cancelRevisionRequestRouter,
  getReviewAssignmentRouter,
  listCategoryReviewersRouter,
  listProposalRevisionRequestsRouter,
  listProposalsRevisionRequestsRouter,
  listReviewAssignmentsRouter,
  removeCategoryReviewerRouter,
  requestRevisionRouter,
  saveReviewDraftRouter,
  submitRevisionResponseRouter,
  submitReviewRouter,
);
