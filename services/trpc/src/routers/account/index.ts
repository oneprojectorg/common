import { mergeRouters } from '../../trpcFactory';
import { getMyAccount } from './getMyAccount';
import { switchOrganization } from './updateLastOrgId';
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
  switchOrganization,
);

export default accountRouter;
