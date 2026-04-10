import { mergeRouters } from '../../../trpcFactory';
import { addUsersToOrganizationRouter } from './addUsersToOrganization';
import { listAllOrganizationsRouter } from './listAllOrganizations';
import { listAllUsersRouter } from './listAllUsers';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  addUsersToOrganizationRouter,
  listAllOrganizationsRouter,
  listAllUsersRouter,
  updateUserProfileRouter,
);
