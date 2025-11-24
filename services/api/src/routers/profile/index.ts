import { mergeRouters } from '../../trpcFactory';
import { getProfileRouter } from './getProfile';
import { inviteProfileUserRouter } from './invite';
import { profileRelationshipRouter } from './relationships';
import { searchProfilesRouter } from './searchProfiles';

const profileRouter = mergeRouters(
  getProfileRouter,
  searchProfilesRouter,
  profileRelationshipRouter,
  inviteProfileUserRouter,
);

export default profileRouter;
