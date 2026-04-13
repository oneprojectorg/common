import { mergeRouters } from '../../../trpcFactory';
import { addUsersToOrganizationRouter } from './addUsersToOrganization';
import { listAllDecisionInstancesRouter } from './listAllDecisionInstances';
import { listAllOrganizationsRouter } from './listAllOrganizations';
import { listAllUsersRouter } from './listAllUsers';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  addUsersToOrganizationRouter,
  listAllDecisionInstancesRouter,
  listAllOrganizationsRouter,
  listAllUsersRouter,
  updateUserProfileRouter,
);
