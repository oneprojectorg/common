import { mergeRouters } from '../../trpcFactory';
import { createRoleRouter } from './createRole';
import { deleteRoleRouter } from './deleteRole';
import { getProfileRouter } from './getProfile';
import { invitationRouter } from './invitation';
import { inviteProfileUserRouter } from './invite';
import { listRolesRouter } from './listRoles';
import { profileRelationshipRouter } from './relationships';
import {
  createJoinRequestRouter,
  deleteJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
} from './requests';
import { searchProfilesRouter } from './searchProfiles';
import { updateRolePermissionRouter } from './updateRolePermission';
import { usersRouter } from './users';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  invitationRouter,
  usersRouter,
  listRolesRouter,
  createRoleRouter,
  updateRolePermissionRouter,
  deleteRoleRouter,
  createJoinRequestRouter,
  deleteJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
);

export default profileRouter;
