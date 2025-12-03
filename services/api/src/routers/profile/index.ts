import { mergeRouters } from '../../trpcFactory';
import { createJoinProfileRequestRouter } from './createJoinProfileRequest';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { profileRelationshipRouter } from './relationships';
import { searchProfilesRouter } from './searchProfiles';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  createJoinProfileRequestRouter,
);

export default profileRouter;
