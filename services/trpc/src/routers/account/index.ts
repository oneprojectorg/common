import { mergeRouters } from '../../trpcFactory';

import getProfile from './getUserProfile';
import login from './login';
import updateUserProfile from './updateUserProfile';
import usedStorage from './usedStorage';
import usernameAvailable from './usernameAvailable';

const accountRouter = mergeRouters(
  login,
  getProfile,
  updateUserProfile,
  usernameAvailable,
  usedStorage,
);

export default accountRouter;
