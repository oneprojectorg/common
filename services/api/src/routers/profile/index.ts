import { mergeRouters } from '../../trpcFactory';
import { getProfileRouter } from './getProfile';
import { searchProfilesRouter } from './searchProfiles';

const profileRouter = mergeRouters(getProfileRouter, searchProfilesRouter);

export default profileRouter;
