import { mergeRouters } from '../../../trpcFactory';
import { addCategoryReviewerRouter } from './addCategoryReviewer';
import { assignReviewsRouter } from './assignReviews';
import { cancelRevisionRequestRouter } from './cancelRevisionRequest';
import { getReviewAssignmentRouter } from './getReviewAssignment';
import { listCategoryReviewersRouter } from './listCategoryReviewers';
import { listEligibleReviewersRouter } from './listEligibleReviewers';
import { listPhaseReviewAssignmentsRouter } from './listPhaseReviewAssignments';
import { listPhaseReviewerSummariesRouter } from './listPhaseReviewerSummaries';
import { listProposalFeedbackRouter } from './listProposalFeedback';
import { listProposalRevisionNotesRouter } from './listProposalRevisionNotes';
import { listProposalRevisionRequestsRouter } from './listProposalRevisionRequests';
import { listProposalsRevisionRequestsRouter } from './listProposalsRevisionRequests';
import { listReviewAssignmentLocationsRouter } from './listReviewAssignmentLocations';
import { listReviewAssignmentsRouter } from './listReviewAssignments';
import { listReviewerAssignmentsRouter } from './listReviewerAssignments';
import { listReviewerCategoriesRouter } from './listReviewerCategories';
import { removeCategoryReviewerRouter } from './removeCategoryReviewer';
import { removeReviewAssignmentsRouter } from './removeReviewAssignments';
import { requestRevisionRouter } from './requestRevision';
import { saveReviewDraftRouter } from './saveReviewDraft';
import { submitProposalRevisionRouter } from './submitProposalRevision';
import { submitReviewRouter } from './submitReview';
import { updateReviewRouter } from './updateReview';

export const reviewsRouter = mergeRouters(
  addCategoryReviewerRouter,
  assignReviewsRouter,
  cancelRevisionRequestRouter,
  getReviewAssignmentRouter,
  listCategoryReviewersRouter,
  listEligibleReviewersRouter,
  listReviewerCategoriesRouter,
  listProposalFeedbackRouter,
  listProposalRevisionNotesRouter,
  listProposalRevisionRequestsRouter,
  listProposalsRevisionRequestsRouter,
  listPhaseReviewAssignmentsRouter,
  listPhaseReviewerSummariesRouter,
  listReviewAssignmentLocationsRouter,
  listReviewAssignmentsRouter,
  listReviewerAssignmentsRouter,
  removeCategoryReviewerRouter,
  removeReviewAssignmentsRouter,
  requestRevisionRouter,
  saveReviewDraftRouter,
  submitProposalRevisionRouter,
  submitReviewRouter,
  updateReviewRouter,
);
