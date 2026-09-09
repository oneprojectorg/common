import { mergeRouters } from '../../../trpcFactory';
import { addUsersToOrganizationRouter } from './addUsersToOrganization';
import { getAdminStatsRouter } from './getAdminStats';
import { listAllDecisionInstancesRouter } from './listAllDecisionInstances';
import { listAllOrganizationsRouter } from './listAllOrganizations';
import { listAllUsersRouter } from './listAllUsers';
import { revertDecisionPhaseRouter } from './revertDecisionPhase';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  addUsersToOrganizationRouter,
  getAdminStatsRouter,
  listAllDecisionInstancesRouter,
  listAllOrganizationsRouter,
  listAllUsersRouter,
  revertDecisionPhaseRouter,
  updateUserProfileRouter,
);
