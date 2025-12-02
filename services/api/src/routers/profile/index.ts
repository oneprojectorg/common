import { mergeRouters } from '../../trpcFactory';
import { createJoinProfileRequestRouter } from './createJoinProfileRequest';
import { getJoinProfileRequestRouter } from './getJoinProfileRequest';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { listJoinProfileRequestsRouter } from './listJoinProfileRequests';
import { profileRelationshipRouter } from './relationships';
import { searchProfilesRouter } from './searchProfiles';
import { updateJoinProfileRequestRouter } from './updateJoinProfileRequest';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  createJoinProfileRequestRouter,
  getJoinProfileRequestRouter,
  listJoinProfileRequestsRouter,
  updateJoinProfileRequestRouter,
);

export default profileRouter;
