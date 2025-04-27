import { mergeRouters } from '../../trpcFactory';

import { getMyAccount } from './getMyAccount';
import login from './login';
import updateUserProfile from './updateUserProfile';
import { uploadAvatarImage } from './uploadAvatarImage';
import usedStorage from './usedStorage';
import usernameAvailable from './usernameAvailable';

const accountRouter = mergeRouters(
  login,
  getMyAccount,
  updateUserProfile,
  usernameAvailable,
  usedStorage,
  uploadAvatarImage,
);

export default accountRouter;
