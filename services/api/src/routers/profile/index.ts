import { mergeRouters } from '../../trpcFactory';
import { getProfileRouter } from './getProfile';
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
import { usersRouter } from './users';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  usersRouter,
  listRolesRouter,
  createJoinRequestRouter,
  deleteJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
);

export default profileRouter;
