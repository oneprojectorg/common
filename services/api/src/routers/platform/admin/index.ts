import { mergeRouters } from '../../../trpcFactory';
import { addUsersToOrganizationRouter } from './addUsersToOrganization';
import { listAllUsersRouter } from './listAllUsers';
import { removeUserRouter } from './removeUser';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  addUsersToOrganizationRouter,
  listAllUsersRouter,
  removeUserRouter,
  updateUserProfileRouter,
);
