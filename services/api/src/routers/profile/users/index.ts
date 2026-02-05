import { mergeRouters } from '../../../trpcFactory';
import { listUsersRouter } from './listUsers';
import { removeUserRouter } from './removeUser';
import { updateUserRolesRouter } from './updateUserRole';

export const usersRouter = mergeRouters(
  listUsersRouter,
  updateUserRolesRouter,
  removeUserRouter,
);

export { listUsersRouter, removeUserRouter, updateUserRolesRouter };
