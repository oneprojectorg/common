import { mergeRouters } from '../../../trpcFactory';
import { addUserRouter } from './addUser';
import { listUsersRouter } from './listUsers';
import { removeUserRouter } from './removeUser';
import { updateUserRolesRouter } from './updateUserRole';

export const usersRouter = mergeRouters(
  listUsersRouter,
  addUserRouter,
  updateUserRolesRouter,
  removeUserRouter,
);

export {
  addUserRouter,
  listUsersRouter,
  removeUserRouter,
  updateUserRolesRouter,
};
