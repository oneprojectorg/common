import { mergeRouters } from '../../trpcFactory';
import { profileRelationshipRouter } from './relationships';
import { getProfileRouter } from './getProfile';
import { searchProfilesRouter } from './searchProfiles';
import { searchProfilesByBoundsRouter } from './searchProfilesByBounds';

const profileRouter = mergeRouters(getProfileRouter, searchProfilesRouter, searchProfilesByBoundsRouter, profileRelationshipRouter);

export default profileRouter;
