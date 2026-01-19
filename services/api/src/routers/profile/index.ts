import { mergeRouters } from '../../trpcFactory';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { usersRouter } from './users';
import { profileRelationshipRouter } from './relationships';
import {
  createJoinRequestRouter,
  deleteJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
} from './requests';
import { searchProfilesRouter } from './searchProfiles';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  usersRouter,
  createJoinRequestRouter,
  deleteJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
);

export default profileRouter;
