import { mergeRouters } from '../../../trpcFactory';
import { addUsersToOrganizationRouter } from './addUsersToOrganization';
import { assignReviewsRouter } from './assignReviews';
import { getAdminStatsRouter } from './getAdminStats';
import { getDecisionInstanceRouter } from './getDecisionInstance';
import { listAllDecisionInstancesRouter } from './listAllDecisionInstances';
import { listAllOrganizationsRouter } from './listAllOrganizations';
import { listAllUsersRouter } from './listAllUsers';
import { listDecisionReviewAssignmentsRouter } from './listDecisionReviewAssignments';
import { revertDecisionPhaseRouter } from './revertDecisionPhase';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  addUsersToOrganizationRouter,
  assignReviewsRouter,
  getAdminStatsRouter,
  getDecisionInstanceRouter,
  listAllDecisionInstancesRouter,
  listAllOrganizationsRouter,
  listAllUsersRouter,
  listDecisionReviewAssignmentsRouter,
  revertDecisionPhaseRouter,
  updateUserProfileRouter,
);
