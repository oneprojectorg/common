import { mergeRouters } from '../../../trpcFactory';
import { cancelRevisionRequestRouter } from './cancelRevisionRequest';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listAllReviewAssignmentsRouter } from './listAllReviewAssignments';
import { listProposalRevisionRequestsRouter } from './listProposalRevisionRequests';
import { listProposalsRevisionRequestsRouter } from './listProposalsRevisionRequests';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { requestRevisionRouter } from './requestRevision';
import { saveReviewDraftRouter } from './saveReviewDraft';
import { submitReviewRouter } from './submitReview';
import { submitRevisionResponseRouter } from './submitRevisionResponse';

export const reviewsRouter = mergeRouters(
  cancelRevisionRequestRouter,
  getReviewAssignmentRouter,
  listAllReviewAssignmentsRouter,
  listProposalRevisionRequestsRouter,
  listProposalsRevisionRequestsRouter,
  listReviewAssignmentsRouter,
  requestRevisionRouter,
  saveReviewDraftRouter,
  submitRevisionResponseRouter,
  submitReviewRouter,
);
