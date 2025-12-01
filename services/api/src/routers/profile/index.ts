import { mergeRouters } from '../../trpcFactory';
import { addJoinProfileRequestRouter } from './addJoinProfileRequest';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { profileRelationshipRouter } from './relationships';
import { searchProfilesRouter } from './searchProfiles';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
  addJoinProfileRequestRouter,
);

export default profileRouter;
