import { mergeRouters } from '../../../trpcFactory';
import { addUserRouter } from './addUser';
import { listUsersRouter } from './listUsers';
import { removeUserRouter } from './removeUser';
import { updateUserRoleRouter } from './updateUserRole';

export const usersRouter = mergeRouters(
  listUsersRouter,
  addUserRouter,
  updateUserRoleRouter,
  removeUserRouter,
);

export { addUserRouter, listUsersRouter, removeUserRouter, updateUserRoleRouter };
