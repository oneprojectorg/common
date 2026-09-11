import { mergeRouters } from '../../../trpcFactory';
import { addUsersToOrganizationRouter } from './addUsersToOrganization';
import { getAdminStatsRouter } from './getAdminStats';
import { getUserRouter } from './getUser';
import { listAllDecisionInstancesRouter } from './listAllDecisionInstances';
import { listAllOrganizationsRouter } from './listAllOrganizations';
import { listAllUsersRouter } from './listAllUsers';
import { revertDecisionPhaseRouter } from './revertDecisionPhase';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  addUsersToOrganizationRouter,
  getAdminStatsRouter,
  getUserRouter,
  listAllDecisionInstancesRouter,
  listAllOrganizationsRouter,
  listAllUsersRouter,
  revertDecisionPhaseRouter,
  updateUserProfileRouter,
);
