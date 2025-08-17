import { mergeRouters } from '../../trpcFactory';
import { profileRelationshipRouter } from './relationships';
import { getProfileRouter } from './getProfile';
import { searchProfilesRouter } from './searchProfiles';

const profileRouter = mergeRouters(getProfileRouter, searchProfilesRouter, profileRelationshipRouter);

export default profileRouter;
