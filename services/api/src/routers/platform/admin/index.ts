import { mergeRouters } from '../../../trpcFactory';
import { listAllUsersRouter } from './listAllUsers';
import { updateUserProfileRouter } from './updateUserProfile';

export const platformAdminRouter = mergeRouters(
  listAllUsersRouter,
  updateUserProfileRouter,
);
