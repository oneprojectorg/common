import { mergeRouters } from '../../trpcFactory';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { profileRelationshipRouter } from './relationships';
import {
  createJoinRequestRouter,
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
  createJoinRequestRouter,
  getJoinRequestRouter,
  listJoinRequestsRouter,
  updateJoinRequestRouter,
);

export default profileRouter;
