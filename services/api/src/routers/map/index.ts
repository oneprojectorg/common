import { mergeRouters } from '../../trpcFactory';
import { getProfilesForMapRouter } from './getProfilesForMap';
import { updateProfileLocationRouter } from './updateProfileLocation';

export const mapRouter = mergeRouters(
  getProfilesForMapRouter,
  updateProfileLocationRouter
);

export default mapRouter;