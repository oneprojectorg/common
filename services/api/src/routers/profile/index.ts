import { mergeRouters } from '../../trpcFactory';
import { getProfileRouter } from './getProfile';

const profileRouter = mergeRouters(getProfileRouter);

export default profileRouter;