import { mergeRouters } from '../../trpcFactory';
import { acceptInviteRouter } from './acceptInvite';
import { createRoleRouter } from './createRole';
import { decisionCapabilitiesRouter } from './decisionCapabilities';
import { declineInviteRouter } from './declineInvite';
import { deleteProfileInviteRouter } from './deleteProfileInvite';
import { deleteRoleRouter } from './deleteRole';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { listProfileInvitesRouter } from './listProfileInvites';
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
  acceptInviteRouter,
  declineInviteRouter,
  decisionCapabilitiesRouter,
  deleteProfileInviteRouter,
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  listProfileInvitesRouter,
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
